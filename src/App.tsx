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
  showBlueSecondaryEdges: true, showRedSecondaryEdges: true,
  showCorners: true,
  showTrace: true,
};

// -----------------------------------------------------------------------------
// Support for serializing Options (into the URL hash section) and for
// deserializing again

const flag2option: {[k:string]: string} = {};
const option2flag: {[k:string]: string} = {};
const option2type: {[k:string]: string} = {};
`
A1 :b:showPrimaryAxis
H1B:b:showBluePrimaryHands
H1R:b:showRedPrimaryHands
E1B:b:showBluePrimaryEdges
E1R:b:showRedPrimaryEdges
A2B:b:showBlueSecondaryAxes
A2R:b:showRedSecondaryAxes
H2B:b:showBlueSecondaryHands
H2R:b:showRedSecondaryHands
E2B:b:showBlueSecondaryEdges
E2R:b:showRedSecondaryEdges
C  :b:showCorners
T  :b:showTrace
cA :n:cornersA
cB :n:cornersB
pA :n:percentageA
bS :n:baseSpeed
MS :b:manualSpeedup
sA :n:speedupA
sB :n:speedupB
`.trim().split(/\r\n|\r|\n/).forEach(line => {
  const [f, t, o] = line.trim().split(":").map(field => field.trim());
  flag2option[f] = o;
  option2flag[o] = f;
  option2type[o] = t;
});

const options2hash = (options: Options): string =>
  "#" +
  Object.entries(options).flatMap(([k, v]) =>
    v === false ? [] :
    v === true  ? [option2flag[k]] :
    [option2flag[k] + "=" + v]
  ).join("&");

const hash2options = (sWithHash: string): Options => {
  const s = sWithHash.replace(/^#/, "");
  if (!s) {
    // no hash (yet); return default
    return initialOptions;
  }
  const raw = Object.fromEntries(
    s.split("&").map(entry => entry.split("="))
  );
  return Object.fromEntries(Object.keys(initialOptions).map(o => [o,
    option2type[o] === "b" ? option2flag[o] in raw       :
    option2type[o] === "n" ? Number(raw[option2flag[o]]) :
    "### SHOULD NOT OCCUR ###"
  ])) as Options;
}

// -----------------------------------------------------------------------------

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

// Shorthand for links to save
// - typing "&amp;" for each "&" and
// - typing certain parameters that are always the same.
const Switch: FC<{to: string}> = ({to, children}) => (
  <a href={"#" + to.replace("||", "&pA=60&bS=2&MS&sA=3&sB=-4&").replaceAll("|", "&")}>
    {children}
  </a>
);

const Documentation = () => (
  <div style={{margin: 10}}>
    <h1>Some Notes On The "3-4-7 Miracle"</h1>
    <p>
      <i>(See this <a href="https://youtu.be/oEN0o9ZGmOM" target="_blank">
        Mathologer video
      </a> for an introduction.)</i>
    </p>
    <p>
      Watch a <Switch to="cA=4|cB=3||C">bunch of points flying around</Switch>.
      They can be either grouped
      into <Switch to="cA=4|cB=3||E2B|C">4 rotating triangles</Switch> or
      into <Switch to="cA=4|cB=3||E2R|C">3 rotating squares</Switch>.
      Notice that all the points
      follow <Switch to="cA=4|cB=3||C|T">a star-shaped trace</Switch>.
    </p>
    <p>
      How does this work?
    </p>
    <p>
      Let's go back to
      the <Switch to="cA=4|cB=3||E2B|C">rotating triangles</Switch>.
      We add
      the <Switch to="cA=4|cB=3||A2B|E2B|C">centers</Switch> of
      the rotating triangles.
      These actually rotate around
      a <Switch to="cA=4|cB=3||A1|A2B|E2B|C">common axis</Switch>.
      Let's <Switch to="cA=4|cB=3||A1|H1B|A2B|E2B|C">connect
      the triangle centers to the common axis</Switch> using some "clock hands".
      For similarity we
      also <Switch to="cA=4|cB=3||A1|H1B|A2B|H2B|C">
        replace the triangle edges with "clock hands"</Switch>.
      (You might have recognized that things like this
      have been implemented in hardware
      in <a href="https://www.youtube.com/results?search_query=calypso+ride" target="_blank">
        one way</a> or <a href="https://www.youtube.com/results?search_query=scrambler+amusement+park+ride" target="_blank">
        another</a>.)
    </p>
    <p>
      We now concentrate on
      a <Switch to="cA=1|cB=3||A1|H1B|A2B|H2B|C">single "satellite"</Switch> with
      a <Switch to="cA=1|cB=1||A1|H1B|A2B|H2B|C">single "sub-satellite"</Switch>.
      The motion of the sub-satellite is just the combination of two rotating "clock hands".
      The "order" of the clock hands actually does not matter.
      We could also <Switch to="cA=1|cB=1||A1|H1B|H1R|A2B|A2R|H2B|C">
        let the shorter hand rotate around the central axis
      </Switch> and <Switch to="cA=1|cB=1||A1|H1B|H1R|A2B|A2R|H2B|H2R|C">
        mount the longer hand at the tip of the shorter one</Switch>.
      (Remember the <a href="https://en.wikipedia.org/wiki/Euclidean_vector#Addition_and_subtraction" target="_blank">
        parallelogram of vector addition</a>?)
    </p>
    <p>
      We can go back the path that we came here, but now based on the
      "red approach", that is, with the shorter clock hand(s) "A" in the center
      and the longer hand(s) "B" in the satellites:
      {} <Switch to="cA=1|cB=1||A1|H1R|A2R|H2R|C">1</Switch>,
      {} <Switch to="cA=4|cB=1||A1|H1R|A2R|H2R|C">2</Switch>,
      {} <Switch to="cA=4|cB=3||A1|H1R|A2R|H2R|C">3</Switch>,
      {} <Switch to="cA=4|cB=3||A1|H1R|A2R|E2R|C">4</Switch>,
      {} <Switch to="cA=4|cB=3||A1|A2R|E2R|C">5</Switch>,
      {} <Switch to="cA=4|cB=3||A2R|E2R|C">6</Switch>,
      {} <Switch to="cA=4|cB=3||E2R|C">7</Switch>.
      So it's no more surprising that we can replace the 4 rotating triangles with 3 rotating
      squares using the same points.
    </p>
    <p>
      Now for the star-shaped trace.
      Let's go back to
      the <Switch to="cA=1|cB=1||A1|H1B|H1R|A2B|A2R|H2B|H2R|C">
        vector addition parallelogram</Switch>,
      where we now
      {} <Switch to="cA=1|cB=1||A1|H1B|H1R|A2B|A2R|C">
        omit the outer hands</Switch> for simplicity.
      Notice that the red hand rotates slightly faster than the blue one.
      (And they rotate in opposite directions.)
      Whenever the two hands meet (that is, point in the same direction),
      the resulting point (the "sub-sattelite") has its maximum distance
      from the center.  From one such meeting point to the next the blue
      hand does 3/7 of a full rotation and the red hand does 4/7.
      This is because we have selected a speed ratio of 3:4 between the
      two hands (actually -3:4 because one hand goes clockwise and the
      other one goes counterclockwise).
      This should explain why the trace is
      a <Switch to="cA=1|cB=1||A1|H1B|H1R|A2B|A2R|C|T">
        star with 7 corners</Switch>.
    </p>
    <p>
      And why do all the other points in the original configuration
      also follow the same trace?
      This is because we have selected the rotation speeds in such a way
      that the 3 red and 4 blue clock hands will always meet in the same
      7 directions as we can
      see <Switch to="cA=4|cB=3||A1|H1B|H1R|A2B|A2R|C|T">
        here</Switch>.
    </p>
    <h1>Bells &amp; Whistles</h1>
    <p>
      Feel free to play with the bells and whistles to find other
      intersting cases.
      Most of the configuration UI should be easy to understand,
      at least with some experimentation.
      <br/>
      Some things need explanation, however:
    </p>
    <ul>
      <li>
        If you untick the "manual speedup", then the relative speeds
        will be chosen automatically in a way appropriate for the numbers
        of corners selected above.
        (But notice that all points follow the same trace only if the numbers of
        corners are coprime.)
      </li>
      <li>
        If the relative speeds do not fit with the numbers of corners,
        only the "primary point" (the one with the white dot) follows
        the trace.
      </li>
      <li>
        If the "speedups" (factors on top of the base speed) are
        non-integral, the trace might not be closed (as far as we draw
        it).
      </li>
      <li>
        The base speed is measured in rounds per minute.
      </li>
      <li>
        The configuration is reflected in the URL.  This allows you
        to bookmark your favorite configs, and you can use your
        browser's "back" and "forward" buttons as "undo" and "redo"
        operations.
      </li>
    </ul>
  </div>
);

function App() {
  const [options, setOptionsRaw] = useState(initialOptions);

  // We intercept setOptions to serialize new options to the URL hash.
  // We also intercept hash changes and deserialize the hash into the options state.

  function setOptions(update: Options | ((old: Options) => Options)): void {
    window.location.hash = options2hash(
      update instanceof Function ? update(options) : update
    );
    // No need to call setOptionsRaw(...) here because the hash update will
    // trigger a "hashchange" event and thus invoke setOptionsRaw(...) in the
    // event handler function readHash().
  }

  useEffect(() => {
    function readHash() {
      setOptionsRaw(hash2options(window.location.hash));
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const speedRef = useRef(0);
  speedRef.current = options.baseSpeed;
  return (
    <ProvideDisplayOptions value={options} setter={setOptions}>
      <ProvideRounds speedRef={speedRef}>
        <div>
          <div style={{display: "flex", flexFlow: "row wrap", alignItems: "top"}}>
            <svg viewBox="-1.1 -1.1 2.2 2.2" width="600" height="600">
              {options.showTrace && (<Trace/>)}
              <MovingParts/>
            </svg>
            <Config/>
          </div>
          <Documentation/>
        </div>
      </ProvideRounds>
    </ProvideDisplayOptions>
  );
}

export default App;
