import { createRoot } from "react-dom/client";
import * as React from "react";

function counter(state, action) {
  if (action.type === "add") return state + action.payload;
  return state;
}

function App() {
  const [number, setNumber] = React.useState(0);
  React.useEffect(() => {
    console.log("useEffect1");
    return () => {
      console.log("destroy useEffect1");
    };
  }, []);
  React.useLayoutEffect(() => {
    console.log("useLayoutEffect2");
    return () => {
      console.log("destroy useLayoutEffect2");
    };
  });
  React.useEffect(() => {
    console.log("useEffect3");
    return () => {
      console.log("destroy useEffect3");
    };
  });
  return <button onClick={() => setNumber(number + 1)}>{number}</button>;
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
