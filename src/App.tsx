import {
  Context, createContext, FC, Fragment, ReactNode,
  useContext, useEffect, useRef, useState
} from "react";
import "./App.css";

// -----------------------------------------------------------------------------
// Tunable parameters
// We might make some of these configurable by the user

const maxCorners = 10;

const maxBaseSpeed = 10;
const baseSpeedStep = 0.1;

const manualStep = 0.001;

const maxSpeedup = 10;
const speedupStep = 0.1;

const primaryStrokeWidth = 0.02;
const secondaryStrokeWidth = 0.01;
const helperStrokeWidth = 0.01;

const primaryDot = 0.03;
const secondaryDot = 0.03;
const tertiaryDot = 0.02;
const markSize = 0.01;

const blue = "blue";
const red = "red";
const grey = "lightgrey";

// TODO: more constants?

const traceSteps = 1000; // How many segments to use for a trace.

// -----------------------------------------------------------------------------

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
  showBluePrimaryCircle: boolean, showRedPrimaryCircle: boolean,
  showBlueSecondaryAxes: boolean, showRedSecondaryAxes: boolean,
  showBlueSecondaryHands: boolean, showRedSecondaryHands: boolean,
  showBlueSecondaryEdges: boolean, showRedSecondaryEdges: boolean,
  showBlueSecondaryCircles: boolean, showRedSecondaryCircles: boolean,
  showCorners: boolean,
  showTrace: boolean,
  showInnerCircle: boolean,
  showOuterCircle: boolean,
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
  showBluePrimaryCircle: false, showRedPrimaryCircle: false,
  showBlueSecondaryAxes: false, showRedSecondaryAxes: false,
  showBlueSecondaryHands: false, showRedSecondaryHands: false,
  showBlueSecondaryEdges: true, showRedSecondaryEdges: true,
  showBlueSecondaryCircles: false, showRedSecondaryCircles: false,
  showCorners: true,
  showTrace: true,
  showInnerCircle: false,
  showOuterCircle: false,
};

// -----------------------------------------------------------------------------
// Support for serializing and deserializing Options (to/from the URL hash)

const flag2option: {[k:string]: string} = {};
const option2flag: {[k:string]: string} = {};
const option2type: {[k:string]: string} = {};
`
A1 :b:showPrimaryAxis
H1B:b:showBluePrimaryHands
H1R:b:showRedPrimaryHands
E1B:b:showBluePrimaryEdges
E1R:b:showRedPrimaryEdges
C1B:b:showBluePrimaryCircle
C1R:b:showRedPrimaryCircle
A2B:b:showBlueSecondaryAxes
A2R:b:showRedSecondaryAxes
H2B:b:showBlueSecondaryHands
H2R:b:showRedSecondaryHands
E2B:b:showBlueSecondaryEdges
E2R:b:showRedSecondaryEdges
C2B:b:showBlueSecondaryCircles
C2R:b:showRedSecondaryCircles
C  :b:showCorners
T  :b:showTrace
Ci :b:showInnerCircle
Co :b:showOuterCircle
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

/** type of the second return value of useState(...) */
type Setter<T> = (update: T | ((old: T) => T)) => void;

// These contexts have no reasonable default values.  So we just provide
// some dummy values of the appropriate types to createContext(...).
const OptionsCtx: Context<Options> = createContext(initialOptions);
const SetOptionsCtx: Context<Setter<Options>> = createContext((x: any) => {});

/**
 * Provide the current options in context `OptionsCtx` and the setter function
 * in context `SetOptionsCtx`.
 *
 * Notice that this component does not manage the actual state.
 */
const ProvideOptions: FC<{value: Options, setter: Setter<Options>}> =
  ({value, setter, children}) => (
    <OptionsCtx.Provider value={value}>
      <SetOptionsCtx.Provider value={setter}>
        {children}
      </SetOptionsCtx.Provider>
    </OptionsCtx.Provider>
  );

const Rounds: Context<number> = createContext(0);
const SetRounds: Context<Setter<number>> = createContext((x: any) => {});

/**
 * Manage a state containing the "simulated time"
 * (similar to a position in an audio or video recording).
 *
 * The simulated time is measured in "rounds".  With a speed of 1 a round takes
 * a minute.  Speeds below/above 1 correspond to slow motion/fast motion,
 * a speed of 0 stops the simulated time.
 *
 * The speed is given as the current value of property `speedRef`.
 *
 * The current simulated time is provided in context `Rounds`.  A setter for
 * the simulated time is provided in context `SetRounds`.
 */
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
  }, [speedRef]);

  return (
    <Rounds.Provider value={rounds}>
      <SetRounds.Provider value={setRounds}>
        {children}
      </SetRounds.Provider>
    </Rounds.Provider>
  );
};

/** Creates an array [0, 1, 2, ..., n-1] */
const indices = (n: number): number[] => Array(n).fill(undefined).map((_,i) => i);

/** 2 PI; see https://en.wikipedia.org/wiki/Turn_(angle)#Tau_proposals) */
const TAU = 2 * Math.PI;

type Point = [number, number];

/** convert from polar to cartesian coordinates; angle given in full turns */
const polar = (r: number, turns: number): Point => ([
  r * Math.cos(turns * TAU),
  r * Math.sin(turns * TAU),
]);

/** `mapToElements(values, f)` is like `values.map(f)`, but also provides `key` attributes */
const mapToElements = <T,>(values: T[], f: (value: T, i: number, a: T[]) => ReactNode): JSX.Element[] =>
  values.map((point, i, a) => (<Fragment key={i}>{f(point, i, a)}</Fragment>));

/** radial lines ("clock hands") from the center to the points */
const hands = (points: Point[]): ReactNode => (
  <path strokeLinecap="round" d={points.map(([x,y]) => `M 0 0 L ${x} ${y}`).join(" ")}/>
);

/** a polygon through the points */
const polygon = (points: Point[]): ReactNode => (
  <polygon points={points.map(([x,y]) => `${x},${y}`).join(" ")} strokeLinejoin="round" fill="none"/>
);

/** a circle around the center with the given radius */
const circle = (radius: number): ReactNode => (
  <circle fill="none" r={radius}/>
);

/** a dot at some position (actually a circle) */
const dot = ([cx, cy]: Point, color: string, radius: number, showMark: boolean): ReactNode => (<>
  <circle r={radius} fill={color} cx={cx} cy={cy}/>
  {showMark && (
    <circle fill="white" r={markSize} cx={cx} cy={cy}/>
  )}
</>);

const center: Point = [0, 0];

/**
 * instantiate the referenced SVG definition several times with the given offsets
 *
 * (This function is not called `useWithOffset` to avoid confusion with React hooks.)
 */
const instantiateWithOffsets = (points: Point[], href: string): ReactNode =>
  mapToElements(points, ([x, y]) => (
    <use href={href} transform={`translate(${x} ${y})`} />
  ));

/** extract/compute some values from options */
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
  const options = useContext(OptionsCtx);
  const rounds = useContext(Rounds);

  const {cornersA, cornersB, lengthA, lengthB, speedupA, speedupB} =
    getDimensions(options);

  const pointsA: Point[] =
    indices(cornersA).map(i => polar(lengthA, speedupA * rounds + i / cornersA));
  const pointsB: Point[] =
    indices(cornersB).map(j => polar(lengthB, speedupB * rounds + j / cornersB));

  return (<>
    <g strokeWidth={primaryStrokeWidth} stroke={blue}>
      {options.showBluePrimaryHands  && hands(pointsA)}
      {options.showBluePrimaryEdges  && polygon(pointsA)}
      {options.showBluePrimaryCircle && circle(lengthA) /* actually not moving */}
    </g>
    <g strokeWidth={primaryStrokeWidth} stroke={red}>
      {options.showRedPrimaryHands   && hands(pointsB)}
      {options.showRedPrimaryEdges   && polygon(pointsB)}
      {options.showRedPrimaryCircle  && circle(lengthB) /* actually not moving */}
    </g>

    <defs>
      <g id="blueSecondary" strokeWidth={secondaryStrokeWidth} stroke={blue}>
        {options.showBlueSecondaryHands   && hands(pointsB)}
        {options.showBlueSecondaryEdges   && polygon(pointsB)}
        {options.showBlueSecondaryCircles && circle(lengthB)}
      </g>
      <g id="redSecondary" strokeWidth={secondaryStrokeWidth} stroke={red}>
        {options.showRedSecondaryHands    && hands(pointsA)}
        {options.showRedSecondaryEdges    && polygon(pointsA)}
        {options.showRedSecondaryCircles  && circle(lengthA)}
      </g>
    </defs>
    {instantiateWithOffsets(pointsA, "#blueSecondary")}
    {instantiateWithOffsets(pointsB, "#redSecondary")}

    {options.showPrimaryAxis       && dot(center, "black", primaryDot, true) /* actually not moving */}
    {options.showBlueSecondaryAxes && mapToElements(pointsA, (p, i) => dot(p, blue, secondaryDot, i === 0))}
    {options.showRedSecondaryAxes  && mapToElements(pointsB, (p, j) => dot(p, red , secondaryDot, j === 0))}
    {options.showCorners &&
      mapToElements(pointsA, ([xa, ya], i) =>
        mapToElements(pointsB, ([xb, yb], j) =>
          dot([xa+xb, ya+yb], "black", tertiaryDot, i === 0 && j === 0)
        )
      )
    }
  </>);
}

function Trace(): JSX.Element {
  const options = useContext(OptionsCtx);
  if (!options.showTrace) {
    return <></>;
  }

  const {lengthA, lengthB, speedupA, speedupB} = getDimensions(options);

  const trace = indices(traceSteps+1).map(i => {
    const rounds = i / traceSteps;
    const [xa, ya] = polar(lengthA, speedupA * rounds);
    const [xb, yb] = polar(lengthB, speedupB * rounds);
    return `${xa+xb},${ya+yb}`;
  }).join(" ");

  return (
    <polyline
      points={trace} stroke={grey} strokeWidth={helperStrokeWidth}
      strokeLinejoin="round" strokeLinecap="round" fill="none"
    />
  );
}

function Circles(): JSX.Element {
  const options = useContext(OptionsCtx);
  const {lengthA, lengthB} = getDimensions(options);

  return (
    <g strokeWidth={helperStrokeWidth} stroke={grey}>
      {options.showInnerCircle && circle(Math.abs(lengthA-lengthB))}
      {options.showOuterCircle && circle(lengthA+lengthB)}
    </g>
  );
}

const Graphic = (): JSX.Element => (
  <svg viewBox="-1.1 -1.1 2.2 2.2" width="600" height="600">
    <Trace/>
    <Circles/>
    <MovingParts/>
  </svg>
);

function Config(): JSX.Element {
  const options = useContext(OptionsCtx);
  const setOptions = useContext(SetOptionsCtx);
  const setRounds = useContext(SetRounds);

  const flag = (name: BooleanOption): ReactNode => (
    <input type="checkbox"
      checked={options[name]}
      onChange={e => setOptions(options => ({...options, [name]: e.target.checked}))}
    />
  );
  const slider = (
    name: NumericOption, min: number, max: number, step: number = 1
  ): ReactNode => (
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
              {slider("cornersA", 1, maxCorners)}
              <br/>
              <span>{options.cornersA}</span>
            </td>
          </tr>
          <tr>
            <th>#corners B</th>
            <td>
              {slider("cornersB", 1, maxCorners)}
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
              <br/>
              <button onClick={() => {
                let {speedupA, speedupB} = getDimensions(options);
                if (speedupA === 0 && speedupB === 0) {
                  alert("Use non-zero speedups to make this work");
                  return;
                }
                if (speedupA === speedupB || speedupA === 0 || speedupB === 0) {
                  alert("Use different and non-zero speedups to see some effect");
                }
                speedupA = Math.abs(speedupA);
                speedupB = Math.abs(speedupB);
                const percentageA = Math.round(100 * speedupB / (speedupB + speedupA));
                setOptions(options => ({...options, percentageA}));
              }}>adjust to rotation speeds</button>
            </td>
          </tr>
          <tr>
            <th>base speed</th>
            <td>
              {slider("baseSpeed", -maxBaseSpeed, maxBaseSpeed, baseSpeedStep)}
              <br/>
              <div style={{display: "inline-block"}}>
                <div>{options.baseSpeed}</div>
                <div style={{marginTop: "5px"}}>
                  <button onClick={
                    () => setOptions(options => ({...options, baseSpeed: 0}))
                  }>stop</button>
                </div>
                <div style={{marginTop: "5px"}}>
                  <button onClick={() => setRounds(rounds => rounds - manualStep)}>&lt;</button>
                  &emsp;
                  <button onClick={() => setRounds(0)}>reset</button>
                  &emsp;
                  <button onClick={() => setRounds(rounds => rounds + manualStep)}>&gt;</button>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <th>manual speedup</th>
            <td>{flag("manualSpeedup")}</td>
          </tr>
          {options.manualSpeedup && (<>
            <tr>
              <th>speedup A</th>
              <td>
                {slider("speedupA", -maxSpeedup, maxSpeedup, speedupStep)}
                <br/>
                <span>{options.speedupA}</span>
              </td>
            </tr>
            <tr>
              <th>speedup B</th>
              <td>
                {slider("speedupB", -maxSpeedup, maxSpeedup, speedupStep)}
                <br/>
                <span>{options.speedupB}</span>
              </td>
            </tr>
          </>)}
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
            <th style={{color: blue}}>{blue}</th>
            <th style={{color: red}}>{red}</th>
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
            <th>primary circle</th>
            <td>{flag("showBluePrimaryCircle")}</td>
            <td>{flag("showRedPrimaryCircle")}</td>
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
            <th>secondary circles</th>
            <td>{flag("showBlueSecondaryCircles")}</td>
            <td>{flag("showRedSecondaryCircles")}</td>
          </tr>
          <tr>
            <th>ends/corners</th>
            <td colSpan={2}>{flag("showCorners")}</td>
          </tr>
          <tr>
            <th>trace</th>
            <td colSpan={2}>{flag("showTrace")}</td>
          </tr>
          <tr>
            <th>inner circle</th>
            <td colSpan={2}>{flag("showInnerCircle")}</td>
          </tr>
          <tr>
            <th>outer circle</th>
            <td colSpan={2}>{flag("showOuterCircle")}</td>
          </tr>
        </tbody>
      </table>
    </div>
    )
}

/** Shorthand for "configuration-change links" to save
 * - typing "&amp;amp;" for each "&amp;" and
 * - typing certain parameters that are always the same in the examples. */
const Switch: FC<{to: string}> = ({to, children}) => (
  <a href={"#" + to.replace("||", "&pA=60&bS=2&MS&sA=3&sB=-4&").replaceAll("|", "&")}>
    {children}
  </a>
);

/** Shorthand for links to different pages (in a different window/tab) */
const RemoteRef: FC<{to: string}> = ({to, children}) => (
  <a href={to} target="_blank" rel="noreferrer">
    {children}
  </a>
);

const hashSign = "#"; // introduced constant to silence eslint

const Documentation = () => (
  <div style={{margin: 10}}>
    <h1>Some Notes On The "3-4-7 Miracle"</h1>
    <p>
      <i>
        (You might want to have a look at this {}
        <RemoteRef to="https://youtu.be/oEN0o9ZGmOM">Mathologer video</RemoteRef> {}
        for an introduction,
        but you can also start with the text here and click the links.)
      </i>
    </p>
    <p>
      Watch a <Switch to="cA=4|cB=3||C">bunch of points flying around</Switch>.
      They can be grouped into
      either <Switch to="cA=4|cB=3||E2B|C">4 rotating triangles</Switch> or
      {} <Switch to="cA=4|cB=3||E2R|C">3 rotating squares</Switch>.
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
      the triangle centers to the common axis</Switch> using some "clock hands"
      or "windmill blades".
      For similarity we
      also <Switch to="cA=4|cB=3||A1|H1B|A2B|H2B|C">
        replace the triangle edges with "clock hands"</Switch>.
      (You might have recognized that things like this have been 
      {} <RemoteRef to="https://www.youtube.com/results?search_query=calypso+OR+scrambler+OR+breakdance+fun+OR+amusement+OR+fairground+ride">
        implemented in hardware
      </RemoteRef>.)
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
      (Remember the <RemoteRef to="https://en.wikipedia.org/wiki/Euclidean_vector#Addition_and_subtraction">
        parallelogram of vector addition</RemoteRef>?)
    </p>
    <p>
      We can go back the path that we came here, but now based on the
      "{red} approach", that is, with the shorter clock hand(s) "A" in the center
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
      Notice that the {red} hand rotates slightly faster than the {blue} one.
      (And they rotate in opposite directions.)
      Whenever the two hands meet (that is, point in the same direction),
      the resulting point (the "sub-satelite") has its maximum distance
      from the center.  From one such meeting point to the next
      the {blue} hand does 3/7 of a full rotation and the {red} hand does 4/7.
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
      that the 3 {red} and 4 {blue} clock hands will always meet in the same
      7 directions as we can
      see <Switch to="cA=4|cB=3||A1|H1B|H1R|A2B|A2R|C|T">
        here</Switch>.
    </p>
    <h1>Bells &amp; Whistles</h1>
    <p>
      Feel free to play with the configuration to find other interesting cases.
      Most of the configuration UI should be easy to understand,
      at least with some experimentation.
      <br/>
      Nevertheless some explanation may be helpful:
    </p>
    <ul>
      <li>
        If you untick the "manual speedup", then the relative speeds
        will be chosen automatically in a way appropriate for the numbers
        of corners selected above.
        (But notice that all points follow the same trace only if the two
        numbers of corners are coprime.)
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
        Clicking the button "adjust to rotation speeds" will adjust the hand
        lengths according to the (manual or automatic) rotation speeds in such a
        way that
        <ul>
          <li>
            the secondary circles roll in the outer circle without slip and
          </li>
          <li>
            the star-shaped trace gets sharp bends,
          </li>
        </ul>
        assuming that the two rotations are in opposite directions.
        <br/>
        If the rotations are in the same direction, the sharp bends of the trace
        point inward and the secondary circles roll around the inner circle
        without slip.
      </li>
      <li>
        The configuration is reflected in the URL.  This allows you
        to bookmark your favorite configurations, and you can use your
        browser's "back" and "forward" buttons as "undo" and "redo"
        operations.
        Default values are used if <a href={hashSign}>the URL lacks a configuration</a>.
      </li>
    </ul>
    <h1>Source code</h1>
    The source code for this application is available
    {} <RemoteRef to="https://github.com/hcschuetz/double-rotation">here</RemoteRef>.
  </div>
);

function App(): JSX.Element {
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
    <ProvideOptions value={options} setter={setOptions}>
      <ProvideRounds speedRef={speedRef}>
        <div>
          <div style={{display: "flex", flexFlow: "row wrap", alignItems: "top"}}>
            <Graphic/>
            <Config/>
          </div>
          <Documentation/>
        </div>
      </ProvideRounds>
    </ProvideOptions>
  );
}

export default App;
