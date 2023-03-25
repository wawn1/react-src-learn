import { createRoot } from "react-dom/client";
function App() {
  return (
    <h1
      id="container"
      onClick={(e) => console.log("h1", e.currentTarget)}
      onClickCapture={(e) => {
        console.log("h1 Capture");
        // e.stopPropagation();
      }}
    >
      hello
      <span
        style={{ color: "red" }}
        onClick={(e) => console.log("span", e.currentTarget)}
        onClickCapture={() => console.log("span Capture")}
      >
        world
      </span>
    </h1>
  );
}

let element = <App />;
const root = createRoot(document.getElementById("root"));
root.render(element);
console.log(root);
