import { createRoot } from "react-dom/client";
import * as React from "react";

function counter(state, action) {
  if (action.type === "add") return state + action.payload;
  return state;
}

function App() {
  const [number, setNumber] = React.useState(0);
  return number === 0 ? (
    <ul key="container" onClick={() => setNumber(number + 1)}>
      <li key="A" id="A">
        A
      </li>
      <li key="B" id="b">
        B
      </li>
      <li key="C" id="C">
        C
      </li>
      <li key="D" id="D">
        D
      </li>
      <li key="E" id="E">
        E
      </li>
      <li key="F" id="F">
        F
      </li>
    </ul>
  ) : (
    <ul key="container" onClick={() => setNumber(number + 1)}>
      <li key="A" id="A">
        A2
      </li>

      <li key="C" id="C">
        C2
      </li>
      <li key="E" id="E">
        E2
      </li>
      <li key="B" id="b2">
        B2
      </li>
      <li key="G" id="G">
        G
      </li>
      <li key="D" id="D">
        D
      </li>
    </ul>
  );
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
