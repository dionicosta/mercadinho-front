import { useState } from "react";
import Login from "./pages/login";
import Produtos from "./pages/produtos";

function App() {
  const [logado, setLogado] = useState(!!localStorage.getItem("token"));

  return (
    <div>
      {logado ? <Produtos /> : <Login setLogado={setLogado} />}
    </div>
  );
}

export default App;
