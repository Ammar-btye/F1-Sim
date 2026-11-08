# F1 Sim

F1 Sim is an intermediate-level Formula 1 race strategy simulator designed to optimize pit stops and tire choices. By processing real-time variables such as tire degradation and simulated weather changes, the tool aims to help teams identify optimal racing strategies under pressure.

The simulator will focus on evaluating pit-stop timing and tire compound selection as race conditions evolve, allowing users to compare strategies and adapt their decisions during a simulated race.

The initial website is a minimal two-section layout: “Everyone”, followed by an interactive 3D circuit. There is no other visible text.

Run `npm install` and `npm run dev` to open the local site. `npm run build` creates the production site in `dist/`.

Drag the circuit to rotate it. Click the viewer before using the mouse wheel to zoom; touch devices support pinch zoom. Keyboard users can focus the viewer and use the arrow keys to rotate, `+` and `-` to zoom, and `Home` to reset. The circular icon also resets the view.

The circuit is Interlagos, the current circuit for the São Paulo Grand Prix weekend of November 6–8, 2026, verified against the [official calendar](https://www.formula1.com/en/racing/2026). This initial layout uses that circuit directly; automatic calendar updates are not implemented. The 3D model uses a geographic circuit outline on a stylized flat plinth, rather than surveyed elevation data.

Circuit geometry: [Tomislav Bacinger / f1-circuits](https://github.com/bacinger/f1-circuits), distributed under the MIT license; see `licenses/f1-circuits.txt`.
