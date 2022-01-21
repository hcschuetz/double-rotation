/**
 * TODO
 * - Put state in URL
 *   - Use links referencing these URLs in explanation story
 * - Draw secondary traces?
 */
import {
  Context, createContext, FC, Fragment, ReactNode,
  useContext, useEffect, useRef, useState
} from 'react';
import './App.css';

type Options = {
  cornersA: number, cornersB: number,
  percentageA: number,
  baseSpeed: number,
  manualSpeedup: boolean,
  speedupA: number,
  speedupB: number,
  showPrimaryAxis: boolean,
  showBluePrimaryHands: boolean, showRedPrimaryHands: boolean,
  showBluePrimaryEdges: boolean, showRedPrimaryEdges: boolean,
  showBlueSecondaryAxes: boolean, showRedSecondaryAxes: boolean,
  showBlueSecondaryHands: boolean, showRedSecondaryHands: boolean,
  showBlueSecondaryEdges: boolean, showRedSecondaryEdges: boolean,
  showCorners: boolean,
  showTrace: boolean,
};

const initialOptions: Options = {
  cornersA: 4,
  cornersB: 3,
  percentageA: 60,
  baseSpeed: 2,
  manualSpeedup: false,
  speedupA: 3,
  speedupB: -4,
  showPrimaryAxis: false, 
  showBluePrimaryHands: false, showRedPrimaryHands: false,
  showBluePrimaryEdges: false, showRedPrimaryEdges: false,
  showBlueSecondaryAxes: false, showRedSecondaryAxes: false,
  showBlueSecondaryHands: false, showRedSecondaryHands: false,
  showBlueSecondaryEdges: true, showRedSecondaryEdges: false,
  showCorners: true,
  showTrace: false,
};

type FilteredKeys<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

type NumericOption = FilteredKeys<Options, number>;
type BooleanOption = FilteredKeys<Options, boolean>;

type Setter<T> = (update: T | ((old: T) => T)) => void;

// All these contexts have no reasonable default values.  So we just provide
// some dummy values of the appropriate types to createContext(...).
const DisplayOptions: Context<Options> = createContext(initialOptions);
const SetDisplayOptions: Context<Setter<Options>> = createContext((x: any) => {});

const ProvideDisplayOptions: FC<{value: Options, setter: Setter<Options>}> =
  ({value, setter, children}) => (
    <DisplayOptions.Provider value={value}>
      <SetDisplayOptions.Provider value={setter}>
        {children}
      </SetDisplayOptions.Provider>
    </DisplayOptions.Provider>
  );

// The numeric value managed by Rounds/SetRounds is the "simulated time"
// (similar to a position in an audio or video recording).
// With a speed of 1 a "round" takes a minute.
const Rounds: Context<number> = createContext(0);
const SetRounds: Context<Setter<number>> = createContext((x: any) => {});

const ProvideRounds: FC<{speedRef: {current: number}}> = ({speedRef, children}) => {
  const [rounds, setRounds] = useState(0);

  const prevTimestamp = useRef(0);
  if (prevTimestamp.current === 0) {
    prevTimestamp.current = performance.now();
  }
  useEffect(() => {
    let terminated = false;
    function update(timestamp: number): void {
      if (terminated) {
        return;
      }
      const deltaT = timestamp - prevTimestamp.current;
      // 60000 is the factor between milliseconds (JS timestamps) and minutes
      // (our "rounds").
      const deltaRounds = deltaT/60000 * speedRef.current;
      setRounds(rounds => rounds + deltaRounds);
      prevTimestamp.current = timestamp;
      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => { terminated = true; }
  }, []);

  return (
    <Rounds.Provider value={rounds}>
      <SetRounds.Provider value={setRounds}>
        {children}
      </SetRounds.Provider>
    </Rounds.Provider>
  );
};

const indices = (n: number): number[] => Array(n).fill(undefined).map((_,i) => i);

const TAU = 2 * Math.PI;

type Point = [number, number];

const polar = (r: number, turns: number): Point => ([
  r * Math.cos(turns * TAU),
  r * Math.sin(turns * TAU),
]);

const line = (p1: Point, p2: Point, color: string, width: number): JSX.Element => (
  <line stroke={color} strokeWidth={width}
    x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
  />
);

const dot = (
  point: Point, color: string, radius: number, showMark: boolean
): JSX.Element => (<>
  <circle r={radius} fill={color} cx={point[0]} cy={point[1]}/>
  {showMark && (
    <circle fill="white" r={0.01} cx={point[0]} cy={point[1]}/>
  )}
</>);

const center: Point = [0, 0];

const forEachHand = (
  hands: Point[],
  f: (point: Point, i: number) => ReactNode,
): JSX.Element[] =>
  hands.map((point, i) => (<Fragment key={i}>{f(point, i)}</Fragment>));

function getDimensions(options: Options) {
  const cornersA = options.cornersA;
  const cornersB = options.cornersB;
  const lengthA = options.percentageA / 100;
  const lengthB = 1 - lengthA;
  const speedupA = options.manualSpeedup ? options.speedupA :  cornersB;
  const speedupB = options.manualSpeedup ? options.speedupB : -cornersA;
  return {cornersA, cornersB, lengthA, lengthB, speedupA, speedupB};
}

function MovingParts(): JSX.Element {
  const options = useContext(DisplayOptions);
  const rounds = useContext(Rounds);

  const {cornersA, cornersB, lengthA, lengthB, speedupA, speedupB} =
    getDimensions(options);

  const handsA: Point[] =
    indices(cornersA).map(i => polar(lengthA, speedupA * rounds + i / cornersA));
  const handsB: Point[] =
    indices(cornersB).map(j => polar(lengthB, speedupB * rounds + j / cornersB));

  const corners: Point[][] =
    handsA.map(([xa, ya]) => handsB.map(([xb, yb]): Point => ([xa+xb, ya+yb])));

  const forEachCorner = (f: (i: number, j: number) => ReactNode): JSX.Element[] =>
    indices(cornersA).map(i => (
      <Fragment key={i}>
        {indices(cornersB).map(j => (
          <Fragment key={j}>
            {f(i, j)}
          </Fragment>
        ))}
      </Fragment>
    ));

  return (<>
    {options.showBluePrimaryHands &&
      forEachHand(handsA, (point, i) => line(center, point, "blue", 0.02))
    }
    {options.showRedPrimaryHands &&
      forEachHand(handsB, (point, j) => line(center, point, "red", 0.02))
    }
    {options.showBluePrimaryEdges &&
      forEachHand(handsA, (point, i) => line(point, handsA[(i+1)%cornersA], "blue", 0.02))
    }
    {options.showRedPrimaryEdges &&
      forEachHand(handsB, (point, j) => line(point, handsB[(j+1)%cornersB], "red", 0.02))
    }
    {options.showBlueSecondaryHands &&
      forEachCorner((i, j) => line(corners[i][j], handsA[i], "blue", 0.01))
    }
    {options.showRedSecondaryHands &&
      forEachCorner((i, j) => line(corners[i][j], handsB[j], "red", 0.01))
    }
    {options.showBlueSecondaryEdges &&
      forEachCorner((i, j) => line(corners[i][j], corners[i][(j+1)%cornersB], "blue", 0.01))
    }
    {options.showRedSecondaryEdges &&
      forEachCorner((i, j) => line(corners[i][j], corners[(i+1)%cornersA][j], "red", 0.01))
    }
    {options.showPrimaryAxis &&
      dot(center, "black", 0.03, true)
    }
    {options.showBlueSecondaryAxes &&
      forEachHand(handsA, (point, i) => dot(point, "blue", 0.03, i === 0))
    }
    {options.showRedSecondaryAxes &&
      forEachHand(handsB, (point, j) => dot(point, "red", 0.03, j === 0))
    }
    {options.showCorners &&
      forEachCorner((i, j) => dot(corners[i][j], "black", 0.02, i === 0 && j === 0))
    }
  </>);
}

// How many segments to use for a trace. (A parameter that can be tuned.)
const traceSteps = 1000;

function Trace(): JSX.Element {
  const options = useContext(DisplayOptions);
  const {lengthA, lengthB, speedupA, speedupB} = getDimensions(options);

  const trace = indices(traceSteps+1).map(i => {
    const rounds = i / traceSteps;
    const [xa, ya] = polar(lengthA, speedupA * rounds);
    const [xb, yb] = polar(lengthB, speedupB * rounds);
    return `${xa+xb},${ya+yb}`;
  }).join(" ");

  return (
    <polyline points={trace} stroke="lightgrey" strokeWidth={0.01} fill="none"/>
  );
}

function Config(): JSX.Element {
  const options = useContext(DisplayOptions);
  const setOptions = useContext(SetDisplayOptions);
  const setRounds = useContext(SetRounds);

  const flag = (name: BooleanOption): JSX.Element => (
    <input type="checkbox"
      checked={options[name]}
      onChange={e => setOptions(options => ({...options, [name]: e.target.checked}))}
    />
  );
  const slider = (
    name: NumericOption, min: number, max: number, step: number = 1
  ): JSX.Element => (
    <input type="range" min={min} max={max} step={step}
      value={options[name]}
      onChange={e => setOptions(options => ({...options, [name]: Number(e.target.value)}))}
    />
  );

  return (
    <div style={{margin: "10px"}}>
      <table style={{display: "inline-table", marginRight: "2em"}}>
        <tbody>
          <tr>
            <th colSpan={2}><u>Parameters</u></th>
          </tr>
          <tr>
            <th>#corners A</th>
            <td>
              {slider("cornersA", 1, 7)}
              <br/>
              <span>{options.cornersA}</span>
            </td>
          </tr>
          <tr>
            <th>#corners B</th>
            <td>
              {slider("cornersB", 1, 7)}
              <br/>
              <span>{options.cornersB}</span>
            </td>
          </tr>
          <tr>
            <th>hand lengths</th>
            <td>
              {slider("percentageA", 0, 100)}
              <br/>
              <span>A: {options.percentageA}%&emsp;B: {100 - options.percentageA}%</span>
            </td>
          </tr>
          <tr>
            <th>base speed</th>
            <td>
              {slider("baseSpeed", -10, 10, 0.1)}
              <br/>
              <div style={{display: "inline-block"}}>
                <div>{options.baseSpeed}</div>
                <div style={{marginTop: "5px"}}>
                  <button onClick={
                    () => setOptions(options => ({...options, baseSpeed: 0}))
                  }>stop</button>
                </div>
                <div style={{marginTop: "5px"}}>
                  <button onClick={() => setRounds(rounds => rounds - 0.001)}>&lt;</button>
                  &emsp;
                  <button onClick={() => setRounds(0)}>reset</button>
                  &emsp;
                  <button onClick={() => setRounds(rounds => rounds + 0.001)}>&gt;</button>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <th>manual speedup</th>
            <td>{flag("manualSpeedup")}</td>
          </tr>
          {options.manualSpeedup && (<Fragment>
            <tr>
              <th>speedup A</th>
              <td>
                {slider("speedupA", -7, 7, 0.1)}
                <br/>
                <span>{options.speedupA}</span>
              </td>
            </tr>
            <tr>
              <th>speedup B</th>
              <td>
                {slider("speedupB", -7, 7, 0.1)}
                <br/>
                <span>{options.speedupB}</span>
              </td>
            </tr>
          </Fragment>)}
        </tbody>
      </table>
      <table style={{display: "inline-table"}}>
        <tbody>
          <tr>
            <th colSpan={3}><u>Display Components</u></th>
          </tr>
          <tr>
            <th>primary axis</th>
            <td colSpan={2}>{flag("showPrimaryAxis")}</td>
          </tr>
          <tr>
            <th></th>
            <td>blue</td>
            <td>red</td>
          </tr>
          <tr>
            <th>primary hands</th>
            <td>{flag("showBluePrimaryHands")}</td>
            <td>{flag("showRedPrimaryHands")}</td>
          </tr>
          <tr>
            <th>primary edges</th>
            <td>{flag("showBluePrimaryEdges")}</td>
            <td>{flag("showRedPrimaryEdges")}</td>
          </tr>
          <tr>
            <th>secondary axes</th>
            <td>{flag("showBlueSecondaryAxes")}</td>
            <td>{flag("showRedSecondaryAxes")}</td>
          </tr>
          <tr>
            <th>secondary hands</th>
            <td>{flag("showBlueSecondaryHands")}</td>
            <td>{flag("showRedSecondaryHands")}</td>
          </tr>
          <tr>
            <th>secondary edges</th>
            <td>{flag("showBlueSecondaryEdges")}</td>
            <td>{flag("showRedSecondaryEdges")}</td>
          </tr>
          <tr>
            <th>ends/corners</th>
            <td colSpan={2}>{flag("showCorners")}</td>
          </tr>
          <tr>
            <th>trace</th>
            <td colSpan={2}>{flag("showTrace")}</td>
          </tr>
        </tbody>
      </table>
    </div>
    )
}

function App() {
  const [options, setOptions] = useState(initialOptions);
  const speedRef = useRef(0);
  speedRef.current = options.baseSpeed;
  return (
    <ProvideDisplayOptions value={options} setter={setOptions}>
      <ProvideRounds speedRef={speedRef}>
        <div style={{display: "flex", flexFlow: "row wrap", alignItems: "top"}}>
          <svg viewBox="-1.1 -1.1 2.2 2.2" width="600" height="600">
            {options.showTrace && (<Trace/>)}
            <MovingParts/>
          </svg>
          <Config/>
        </div>
      </ProvideRounds>
    </ProvideDisplayOptions>
  );
}

export default App;
