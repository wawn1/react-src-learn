import { createRoot } from "react-dom/client";
import * as React from "react";

function counter(state, action) {
  if (action.type === "add") return state + action.payload;
  return state;
}

function App() {
  const [numbers, setNumbers] = React.useState(new Array(10).fill("A"));

  const buttonRef = React.useRef();

  React.useEffect(() => {
    console.log("...........................", buttonRef.current);
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={() => {
        setNumbers((numbers) => numbers.map((number) => number + "C"));
      }}
    >
      {numbers.join("")}
    </button>
  );
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
