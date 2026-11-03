import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import loginLogoDown from "../assets/login-logo-down.svg";
import loginLogo from "../assets/login-logo.png";
import nicoLogo from "../assets/nico1.png";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { loginUser } from "../store/appSlice";

/** Duration shared by the post-login transition timer and progress animations. */
const LOGIN_PROGRESS_DURATION_MS = 3000;

type LoginProps = {
  onLogin: () => void;
};

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const dispatch = useAppDispatch();
  const isSubmitting = useAppSelector((state) => state.app.loading);

  useEffect(() => {
    if (!isLoggingIn) return;

    const timer = window.setTimeout(onLogin, LOGIN_PROGRESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isLoggingIn, onLogin]);

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
        style={{ "--login-progress-duration": `${LOGIN_PROGRESS_DURATION_MS}ms` } as CSSProperties}
        aria-label='Login in progress'
        aria-busy='true'
        aria-live='polite'>
        <section className='login-progress-screen'>
          <div className='login-progress-logo'>
            <img src={nicoLogo} alt='NICO' />
          </div>

          <div className='login-progress-row'>
            <div className='login-progress-track' aria-hidden='true'>
              <div className='login-progress-fill' />
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
