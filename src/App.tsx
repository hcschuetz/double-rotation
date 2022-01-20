/**
 * TODO
 * - Put state in URL
 *   - Use links referencing these URLs for links in explanation story
 * - Draw secondary traces?
 */
import React, { Context, createContext, Fragment, useContext, useEffect, useRef, useState } from 'react';
import './App.css';

const traceSteps = 1000;

type Options = {
  cornersA: number, cornersB: number,
  percentageA: number,
  baseSpeed: number,
  manualSpeedup: boolean,
  speedupA: number,
  speedupB: number,
  showCenter: boolean,
  showPrimaryHandsA: boolean, showPrimaryEndsA: boolean, showPrimaryEdgesA: boolean,
  showSecondaryHandsA: boolean, showSecondaryEdgesA: boolean,
  showPrimaryHandsB: boolean, showPrimaryEndsB: boolean, showPrimaryEdgesB: boolean,
  showSecondaryHandsB: boolean, showSecondaryEdgesB: boolean,
  showSecondaryEnds: boolean,
  showTrace: boolean,
};

type FilteredKeys<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

type NumericOption = FilteredKeys<Options, number>;
type BooleanOption = FilteredKeys<Options, boolean>;

const initialOptions: Options = {
  cornersA: 4,
  cornersB: 3,
  percentageA: 60,
  baseSpeed: 2,
  manualSpeedup: false,
  speedupA: 3,
  speedupB: 4,
  showPrimaryHandsA: false, showPrimaryEndsA: false, showPrimaryEdgesA: false,
  showSecondaryHandsA: false, showSecondaryEdgesA: true,
  showPrimaryHandsB: false, showPrimaryEndsB: false, showPrimaryEdgesB: false,
  showSecondaryHandsB: false, showSecondaryEdgesB: false,
  showCenter: false, showSecondaryEnds: true,
  showTrace: true,
};

const DisplayOptions: Context<Options> = createContext(initialOptions);

const indices = (n: number): number[] => Array(n).fill(undefined).map((_,i) => i);

const TAU = 2 * Math.PI;

const polar = (r: number, turns: number): [number, number] => ([
  r * Math.cos(turns * TAU),
  r * Math.sin(turns * TAU),
]);

function MovingParts(): JSX.Element {
  const options = useContext(DisplayOptions);
  const speedRef = useRef(0);
  speedRef.current = options.baseSpeed;
  const prevTimestamp = useRef(0);
  if (prevTimestamp.current === undefined) {
    prevTimestamp.current = performance.now();
  }
  const [rounds, setRounds] = useState(0);
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
  }, [])

  const p = options.cornersA;
  const q = options.cornersB;
  const speedupA = options.manualSpeedup ? options.speedupA : q;
  const speedupB = options.manualSpeedup ? options.speedupB : p;

  const forEachPoint = (f: (i: number, j: number) => JSX.Element): JSX.Element[] =>
    indices(p).flatMap(i => indices(q).map(j => (
      <Fragment key={`${i},${j}`}>{f(i, j)}</Fragment>
    )));

  // The rotation of one polygon family is coupled to the number of
  // corners of the polygons of the other family.  We could relax this coupling
  // by introducing independent rotations.
  // Notice that the coupling ensures closed traces.
  const pHands = indices(p).map(i =>
    polar(    options.percentageA/100, -speedupA*rounds + i/p)
  );
  const qHands = indices(q).map(j =>
    polar(1 - options.percentageA/100,  speedupB*rounds + j/q)
  );

  const points = pHands.map(([xp, yp]) => qHands.map(([xq, yq]) => (
    [xp+xq, yp+yq]
  )));
  return (<>
    {options.showSecondaryEdgesA && forEachPoint((i, j) => (
      <line stroke="blue" strokeWidth="0.01"
        x1={points[i][ j     ][0]} y1={points[i][ j     ][1]}
        x2={points[i][(j+1)%q][0]} y2={points[i][(j+1)%q][1]}
      />
    ))}
    {options.showSecondaryEdgesB && forEachPoint((i, j) => (
      <line stroke="red" strokeWidth="0.01"
        x1={points[ i     ][j][0]} y1={points[ i     ][j][1]}
        x2={points[(i+1)%p][j][0]} y2={points[(i+1)%p][j][1]}
      />
    ))}
    {options.showPrimaryHandsB && qHands.map(([x, y], j) => (
      <line key={j} stroke="red" strokeWidth="0.02"
        x1={0} y1={0}
        x2={x} y2={y}
      />
    ))}
    {options.showPrimaryEdgesA && pHands.map(([x, y], i) => (
      <line key={i} stroke="blue" strokeWidth="0.02"
        x1={x} y1={y}
        x2={pHands[(i+1)%p][0]} y2={pHands[(i+1)%p][1]}
      />
    ))}
    {options.showPrimaryEdgesB && qHands.map(([x, y], j) => (
      <line key={j} stroke="red" strokeWidth="0.02"
        x1={x} y1={y}
        x2={qHands[(j+1)%q][0]} y2={qHands[(j+1)%q][1]}
      />
    ))}
    {options.showPrimaryHandsA && pHands.map(([x, y], i) => (
      <line key={i} stroke="blue" strokeWidth="0.02"
        x1={0} y1={0}
        x2={x} y2={y}
      />
    ))}
    {options.showPrimaryEndsB && qHands.map(([qx, qy], j) => (
      <circle key={j} fill="red" r={0.03} cx={qx} cy={qy}/>
    ))}
    {options.showSecondaryHandsB && forEachPoint((i, j) => {
      const [px, py] = qHands[j];
      return (
        <line stroke="red" strokeWidth="0.01"
          x1={points[i][j][0]} y1={points[i][j][1]}
          x2={px} y2={py}
        />
      )
    })}
    {options.showSecondaryHandsA && forEachPoint((i, j) => {
      const [qx, qy] = pHands[i];
      return (
        <line stroke="blue" strokeWidth="0.01"
          x1={points[i][j][0]} y1={points[i][j][1]}
          x2={qx} y2={qy}
        />
      )
    })}
    {options.showPrimaryEndsA && pHands.map(([qx, qy], i) => (
      <circle key={i} fill="blue" r={0.03} cx={qx} cy={qy}/>
    ))}
    {options.showSecondaryEnds && forEachPoint((i, j) => (
      <circle r="0.02" fill={i+j ? "black" : "magenta"}
        cx={points[i][j][0]} cy={points[i][j][1]}
      />
    ))}
    {options.showCenter && <circle r={0.03}/>}
  </>);
}

function App() {
  const [options, setOptions] = useState(initialOptions);

  const p = options.cornersA;
  const q = options.cornersB;
  const speedupA = options.manualSpeedup ? options.speedupA : q;
  const speedupB = options.manualSpeedup ? options.speedupB : p;
  const rp = options.percentageA/100;
  const rq = 1-rp;
  const trace = indices(traceSteps+1).map(i => {
    const [xp, yp] = polar(rq,  speedupB*i/traceSteps);
    const [xq, yq] = polar(rp, -speedupA*i/traceSteps);
    return `${xp+xq},${yp+yq}`;
  }).join(" ");

  const flag = (name: BooleanOption): JSX.Element => (
    <input type="checkbox"
      checked={options[name]}
      onChange={e => setOptions({...options, [name]: e.target.checked})}
    />
  );
  const slider = (
    name: NumericOption, min: number, max: number, step: number = 1
  ): JSX.Element => (
    <input type="range" min={min} max={max} step={step}
      value={options[name]}
      onChange={e => setOptions({...options, [name]: Number(e.target.value)})}
    />
  );

  return (
    <DisplayOptions.Provider value={options}>
      <div className="App">
        <svg viewBox="-1.1 -1.1 2.2 2.2" width="600" height="600">
          {options.showTrace && (
            <polyline points={trace} stroke="lightgrey" strokeWidth={0.01} fill="none"/>
           )}
          <MovingParts/>
        </svg>
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
                  <span>{options.baseSpeed}</span>
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
                <th>center</th>
                <td colSpan={2}>{flag("showCenter")}</td>
              </tr>
              <tr>
                <th></th>
                <td>blue</td>
                <td>red</td>
              </tr>
              <tr>
                <th>primary hands</th>
                <td>{flag("showPrimaryHandsA")}</td>
                <td>{flag("showPrimaryHandsB")}</td>
              </tr>
              <tr>
                <th>primary edges</th>
                <td>{flag("showPrimaryEdgesA")}</td>
                <td>{flag("showPrimaryEdgesB")}</td>
              </tr>
              <tr>
                <th>primary ends</th>
                <td>{flag("showPrimaryEndsA")}</td>
                <td>{flag("showPrimaryEndsB")}</td>
              </tr>
              <tr>
                <th>secondary hands</th>
                <td>{flag("showSecondaryHandsA")}</td>
                <td>{flag("showSecondaryHandsB")}</td>
              </tr>
              <tr>
                <th>secondary edges</th>
                <td>{flag("showSecondaryEdgesA")}</td>
                <td>{flag("showSecondaryEdgesB")}</td>
              </tr>
              <tr>
                <th>secondary ends</th>
                <td colSpan={2}>{flag("showSecondaryEnds")}</td>
              </tr>
              <tr>
                <th>trace</th>
                <td colSpan={2}>{flag("showTrace")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DisplayOptions.Provider>
  );
}

export default App;
