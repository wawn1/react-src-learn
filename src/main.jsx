import { createRoot } from "react-dom/client";
import * as React from "react";

function counter(state, action) {
  if (action.type === "add") return state + action.payload;
  return state;
}

function App() {
  const [number, setNumber] = React.useState(0);
  let attrs = { id: "btn1" };
  if (number === 1) {
    delete attrs.id;
    attrs.style = { color: "red" };
  }
  return (
    <button {...attrs} onClick={() => setNumber(number + 1)}>
      {number}
    </button>
  );
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
