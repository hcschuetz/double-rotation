/**
 * TODO
 * - Put state in URL
 *   - Use links referencing these URLs for links in explanation story
 * - Draw secondary traces?
 */
import { Context, createContext, FC, Fragment, useContext, useEffect, useRef, useState } from 'react';
import './App.css';

// How many segments to use for a trace. (A parameter that can be tuned.)
const traceSteps = 1000;

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
  showTrace: true,
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

const Rounds: Context<number> = createContext(0);
const SetRounds: Context<Setter<number>> = createContext((x: any) => {});

const ProvideRounds: FC<{speedRef: {current: number}}> = ({
  speedRef, children
}) => {
  const [rounds, setRounds] = useState(0);

  const prevTimestamp = useRef(0);
  if (prevTimestamp.current === undefined) {
    prevTimestamp.current = performance.now();
  }
  useEffect(() => {
    let terminated = false;
    function update(timestamp: number): void {
      if (terminated) {
        return;
      }
      const deltaT = timestamp - prevTimestamp.current;
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

const polar = (r: number, turns: number): [number, number] => ([
  r * Math.cos(turns * TAU),
  r * Math.sin(turns * TAU),
]);

function MovingParts(): JSX.Element {
  const options = useContext(DisplayOptions);
  const rounds = useContext(Rounds);

  const p = options.cornersA;
  const q = options.cornersB;
  const speedupA = options.manualSpeedup ? options.speedupA :  q;
  const speedupB = options.manualSpeedup ? options.speedupB : -p;

  const forEachPoint = (f: (i: number, j: number) => JSX.Element): JSX.Element[] =>
    indices(p).flatMap(i => indices(q).map(j => (
      <Fragment key={`${i},${j}`}>{f(i, j)}</Fragment>
    )));

  // The rotation of one polygon family is coupled to the number of
  // corners of the polygons of the other family.  We could relax this coupling
  // by introducing independent rotations.
  // Notice that the coupling ensures closed traces.
  const pHands = indices(p).map(i =>
    polar(    options.percentageA/100, speedupA*rounds + i/p)
  );
  const qHands = indices(q).map(j =>
    polar(1 - options.percentageA/100, speedupB*rounds + j/q)
  );

  const points = pHands.map(([xp, yp]) => qHands.map(([xq, yq]) => (
    [xp+xq, yp+yq]
  )));
  return (<>
    {options.showBlueSecondaryEdges && forEachPoint((i, j) => (
      <line stroke="blue" strokeWidth="0.01"
        x1={points[i][ j     ][0]} y1={points[i][ j     ][1]}
        x2={points[i][(j+1)%q][0]} y2={points[i][(j+1)%q][1]}
      />
    ))}
    {options.showRedSecondaryEdges && forEachPoint((i, j) => (
      <line stroke="red" strokeWidth="0.01"
        x1={points[ i     ][j][0]} y1={points[ i     ][j][1]}
        x2={points[(i+1)%p][j][0]} y2={points[(i+1)%p][j][1]}
      />
    ))}
    {options.showRedPrimaryHands && qHands.map(([x, y], j) => (
      <line key={j} stroke="red" strokeWidth="0.02"
        x1={0} y1={0}
        x2={x} y2={y}
      />
    ))}
    {options.showBluePrimaryEdges && pHands.map(([x, y], i) => (
      <line key={i} stroke="blue" strokeWidth="0.02"
        x1={x} y1={y}
        x2={pHands[(i+1)%p][0]} y2={pHands[(i+1)%p][1]}
      />
    ))}
    {options.showRedPrimaryEdges && qHands.map(([x, y], j) => (
      <line key={j} stroke="red" strokeWidth="0.02"
        x1={x} y1={y}
        x2={qHands[(j+1)%q][0]} y2={qHands[(j+1)%q][1]}
      />
    ))}
    {options.showBluePrimaryHands && pHands.map(([x, y], i) => (
      <line key={i} stroke="blue" strokeWidth="0.02"
        x1={0} y1={0}
        x2={x} y2={y}
      />
    ))}
    {options.showRedSecondaryAxes && qHands.map(([qx, qy], j) => (

      <circle key={j} fill="red" r={0.03} cx={qx} cy={qy}/>
    ))}
    {options.showRedSecondaryHands && forEachPoint((i, j) => {
      const [px, py] = qHands[j];
      return (
        <line stroke="red" strokeWidth="0.01"
          x1={points[i][j][0]} y1={points[i][j][1]}
          x2={px} y2={py}
        />
      )
    })}
    {options.showBlueSecondaryHands && forEachPoint((i, j) => {
      const [qx, qy] = pHands[i];
      return (
        <line stroke="blue" strokeWidth="0.01"
          x1={points[i][j][0]} y1={points[i][j][1]}
          x2={qx} y2={qy}
        />
      )
    })}
    {options.showBlueSecondaryAxes && pHands.map(([qx, qy], i) => (
      <circle key={i} fill="blue" r={0.03} cx={qx} cy={qy}/>
    ))}
    {options.showCorners && forEachPoint((i, j) => (
      <circle r="0.02" fill={i+j ? "black" : "magenta"}
        cx={points[i][j][0]} cy={points[i][j][1]}
      />
    ))}
    {options.showPrimaryAxis && <circle r={0.03}/>}
  </>);
}

function Trace(): JSX.Element {
  const options = useContext(DisplayOptions);
  const p = options.cornersA;
  const q = options.cornersB;
  const speedupA = options.manualSpeedup ? options.speedupA : q;
  const speedupB = options.manualSpeedup ? options.speedupB : -p;
  const rp = options.percentageA/100;
  const rq = 1-rp;
  const trace = indices(traceSteps+1).map(i => {
    const [xp, yp] = polar(rq, speedupB*i/traceSteps);
    const [xq, yq] = polar(rp, speedupA*i/traceSteps);
    return `${xp+xq},${yp+yq}`;
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
    <div>
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
