import Phaser from "phaser";
import GameConfig from "../config/GameConfig";

const API_BASE = GameConfig.apiBaseUrl;
const SESSION_DURATION = 6 * 60 * 60 * 1000;

export default class AuthScene extends Phaser.Scene {
  constructor() {
    super("AuthScene");
    this.isLogin = true;
    this.errorText = null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    const token = sessionStorage.getItem("token");
    const sessionTime = sessionStorage.getItem("sessionTime");
    if (token && sessionTime && Date.now() - Number(sessionTime) < SESSION_DURATION) {
      this.scene.start("MenuScene");
      return;
    }

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("playerId");
    sessionStorage.removeItem("sessionTime");

    const formContainer = this.add.dom(width / 2, height / 2).createFromHTML(this._formHTML());
    this._formElements = formContainer;

    formContainer.addListener("click");
    formContainer.on("click", (event) => {
      const target = event.target;
      if (target.id === "tab-login") {
        this.isLogin = true;
        formContainer.setHTML(this._formHTML());
      } else if (target.id === "tab-register") {
        this.isLogin = false;
        formContainer.setHTML(this._formHTML());
      } else if (target.id === "submit-btn") {
        this._handleSubmit();
      }
    });

    formContainer.addListener("keydown");
    formContainer.on("keydown", (event) => {
      if (event.key === "Enter") {
        this._handleSubmit();
      }
    });
  }

  _formHTML() {
    const mode = this.isLogin ? "login" : "register";
    const title = this.isLogin ? "Welcome Back" : "Create Account";
    const submitLabel = this.isLogin ? "Sign In" : "Create Account";
    const switchLabel = this.isLogin
      ? "Don't have an account? <a id='tab-register' style='color:#5eead4;cursor:pointer;text-decoration:underline;'>Register</a>"
      : "Already have an account? <a id='tab-login' style='color:#5eead4;cursor:pointer;text-decoration:underline;'>Sign In</a>";

    return `
      <div style="
        background: #121a33;
        border: 2px solid #5eead4;
        border-radius: 16px;
        padding: 40px 36px;
        width: 360px;
        box-shadow: 0 0 40px rgba(94, 234, 212, 0.15);
        font-family: Arial, sans-serif;
      ">
        <h1 style="
          color: #e9eefc;
          font-size: 28px;
          text-align: center;
          margin: 0 0 4px 0;
        ">Wekonomy</h1>
        <p style="
          color: #7f8bb3;
          font-size: 14px;
          text-align: center;
          margin: 0 0 28px 0;
        ">${title}</p>

        <div style="display:flex; margin-bottom: 24px; border-radius: 8px; overflow: hidden;">
          <div id="tab-login" style="
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            background: ${this.isLogin ? '#5eead4' : '#1e2a4a'};
            color: ${this.isLogin ? '#0b1020' : '#7f8bb3'};
            font-weight: bold;
            font-size: 14px;
          ">Login</div>
          <div id="tab-register" style="
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            background: ${!this.isLogin ? '#5eead4' : '#1e2a4a'};
            color: ${!this.isLogin ? '#0b1020' : '#7f8bb3'};
            font-weight: bold;
            font-size: 14px;
          ">Register</div>
        </div>

        <input id="username-input" type="text" placeholder="Username"
          style="
            width: 100%;
            padding: 12px 14px;
            margin-bottom: 12px;
            border: 1px solid #2a3a5a;
            border-radius: 8px;
            background: #0b1020;
            color: #e9eefc;
            font-size: 15px;
            outline: none;
            box-sizing: border-box;
          "
        />
        <input id="password-input" type="password" placeholder="Password"
          style="
            width: 100%;
            padding: 12px 14px;
            margin-bottom: 20px;
            border: 1px solid #2a3a5a;
            border-radius: 8px;
            background: #0b1020;
            color: #e9eefc;
            font-size: 15px;
            outline: none;
            box-sizing: border-box;
          "
        />

        <button id="submit-btn" style="
          width: 100%;
          padding: 12px;
          background: #5eead4;
          color: #0b1020;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        ">${submitLabel}</button>

        <p id="error-msg" style="
          color: #fb7185;
          font-size: 13px;
          text-align: center;
          margin: 16px 0 0 0;
          min-height: 20px;
        ">${this.errorText || ''}</p>

        <p style="
          color: #7f8bb3;
          font-size: 13px;
          text-align: center;
          margin: 12px 0 0 0;
        ">${switchLabel}</p>
      </div>
    `;
  }

  async _handleSubmit() {
    const usernameEl = document.getElementById("username-input");
    const passwordEl = document.getElementById("password-input");
    const errorEl = document.getElementById("error-msg");

    if (!usernameEl || !passwordEl) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();

    if (!username || !password) {
      if (errorEl) errorEl.textContent = "Please fill in all fields.";
      return;
    }

    const endpoint = this.isLogin ? "/auth/login" : "/auth/register";
    const body = JSON.stringify({ username, password });

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        if (errorEl) errorEl.textContent = data.error || "Request failed.";
        return;
      }

      if (this.isLogin) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("playerId", data.playerId);
        sessionStorage.setItem("sessionTime", String(Date.now()));
      } else {
        // After register, switch to login
        this.isLogin = true;
        this.errorText = null;
        const container = this._formElements;
        container.setHTML(this._formHTML());
        if (errorEl) {
          errorEl.textContent = "Account created! Please sign in.";
          errorEl.style.color = "#34d399";
        }
        return;
      }

      this.scene.start("MenuScene");
    } catch (err) {
      if (errorEl) errorEl.textContent = "Server unreachable. Check that the backend is running.";
    }
  }
}
