// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./Login";
import Home from "./Home";
import Register from "./Register"; // Import the new component

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* New Route */}
        <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
