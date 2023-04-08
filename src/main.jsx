import { createRoot } from "react-dom/client";
import * as React from "react";

let counter = 0;
let bCounter = 0;
let cCounter = 0;
let timer;

function App() {
  const [numbers, setNumbers] = React.useState(new Array(100).fill("A"));

  const divRef = React.useRef();
  const updateB = (numbers) => new Array(100).fill(numbers[0] + "B");
  updateB.id = "updateB" + bCounter++;
  const updateC = (numbers) => new Array(100).fill(numbers[0] + "C");
  updateC.id = "updateC" + cCounter++;

  React.useEffect(() => {
    timer = setInterval(() => {
      divRef.current.click(); // lane 2
      if (counter++ === 0) {
        setNumbers(updateB); // lane 32 会被打断
      }
      divRef.current.click(); // lane 2
      if (counter++ > 10) {
        clearInterval(timer);
      }
    }, 1);
  }, []);

  return (
    <div ref={divRef} onClick={() => setNumbers(updateC)}>
      {numbers.map((number, index) => (
        <span key={index}>{number}</span>
      ))}
    </div>
  );
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
