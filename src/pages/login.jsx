import { useState } from "react";
import { login } from "../services/auth";

export default function Login({ setLogado }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar() {
    try {
      await login(email, senha);
      setLogado(true);
    } catch (err) {
      alert("Login inválido");
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} />
      <button onClick={entrar}>Entrar</button>
    </div>
  );
}
