import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { Alert, Button, Checkbox, Input } from "antd";
import { useState, type AnimationEvent, type FormEvent } from "react";

import loginLogoDown from "../assets/login-logo-down.svg";
import loginLogo from "../assets/login-logo.png";
import nicoLogo from "../assets/nico1.png";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { loginUser } from "../store/appSlice";

const REMEMBER_USERNAME_PREFERENCE_KEY = "rememberUsername";
const REMEMBERED_USERNAME_KEY = "rememberedUsername";

type LoginProps = {
  onLogin: () => void;
};

function Login({ onLogin }: LoginProps) {
  const rememberUsernameByDefault =
    localStorage.getItem(REMEMBER_USERNAME_PREFERENCE_KEY) !== "false";
  const [username, setUsername] = useState(() =>
    rememberUsernameByDefault
      ? localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ""
      : "",
  );
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(rememberUsernameByDefault);

  const dispatch = useAppDispatch();
  const isSubmitting = useAppSelector((state) => state.app.loading);

  const handleProgressAnimationEnd = (
    event: AnimationEvent<HTMLDivElement>,
  ) => {
    if (event.animationName === "login-progress-fill") {
      onLogin();
    }
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || isLoggingIn) {
      return;
    }

    if (!username.trim() || !password) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setLoginError("");

    try {
      await dispatch(
        loginUser({
          username: username.trim(),
          password,
        })
      ).unwrap();

      localStorage.setItem(
        REMEMBER_USERNAME_PREFERENCE_KEY,
        String(rememberMe),
      );
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }

      // Show sync animation screen after successful API login
      setIsLoggingIn(true);
    } catch (error: unknown) {
      setLoginError(
        typeof error === "string"
          ? error
          : "Login failed. Please check your credentials."
      );
    }
  };

  if (isLoggingIn) {
    return (
      <main
        className='login-page login-page--progress'
        aria-label='Login in progress'
        aria-busy='true'
        aria-live='polite'>
        <section className='login-progress-screen'>
          <div className='login-progress-logo'>
            <img src={nicoLogo} alt='NICO' />
          </div>

          <div className='login-progress-row'>
            <div className='login-progress-track' aria-hidden='true'>
              <div
                className='login-progress-fill'
                onAnimationEnd={handleProgressAnimationEnd}
              />
              <div className='login-progress-dot' />
            </div>
            <p className='login-progress-status'>SYNCING CARRIER RATES...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className='login-page' aria-label='Login page'>
      <section className='login-card' aria-labelledby='login-title'>
        <div className='login-logo' id='login-title'>
          <img src={loginLogo} alt='NICO LTL' />
        </div>

        <form className='login-form' onSubmit={handleLoginSubmit}>
          {loginError ? (
            <Alert
              className='login-alert'
              type='error'
              title={loginError}
              showIcon
            />
          ) : null}

          <label className='login-field'>
            <span className='login-label'>
              Username <span aria-hidden='true'>*</span>
            </span>
            <Input
              size='large'
              className='login-input'
              placeholder='name@company.com'
              autoComplete='username'
              value={username}
              disabled={isSubmitting}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className='login-field'>
            <span className='login-label'>
              Password <span aria-hidden='true'>*</span>
            </span>
            <Input.Password
              size='large'
              className='login-input login-password-input'
              placeholder='Enter password'
              autoComplete='current-password'
              value={password}
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </label>

          <div className='login-options'>
            <Checkbox
              className='login-remember'
              checked={rememberMe}
              disabled={isSubmitting}
              onChange={(event) => setRememberMe(event.target.checked)}>
              Remember me
            </Checkbox>

            <button className='login-link' type='button'>
              Forgot Password?
            </button>
          </div>

          <Button
            className='login-submit'
            type='primary'
            htmlType='submit'
            size='large'
            loading={isSubmitting}
            disabled={isSubmitting}
            block>
            {isSubmitting ? "Logging in..." : "Continue"}
          </Button>
        </form>

        <div className='login-footer-logo'>
          <img src={loginLogoDown} alt='Powered by Inland' />
        </div>
      </section>
    </main>
  );
}

export default Login;
