// main.jsx — THE VERY FIRST FILE THAT RUNS
// Finds the <div id="root"> in index.html and mounts the React app inside it.
// You never need to edit this file.

import React    from "react";
import ReactDOM from "react-dom/client";
import App      from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
