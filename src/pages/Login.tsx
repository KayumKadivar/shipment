import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";
import { useEffect, useRef, useState, type FormEvent } from "react";

import inlandLogo from "../assets/inland1.png";
import nicoLogo from "../assets/nico1.png";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { loginUser } from "../store/appSlice";

type LoginProps = {
  onLogin: () => void;
};

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const loginTimerRef = useRef<number | null>(null);

  const dispatch = useAppDispatch();
  const isSubmitting = useAppSelector((state) => state.app.loading);

  useEffect(() => {
    return () => {
      if (loginTimerRef.current !== null) {
        window.clearTimeout(loginTimerRef.current);
      }
    };
  }, []);

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
      loginTimerRef.current = window.setTimeout(() => {
        onLogin();
      }, 2000);
    } catch (error: any) {
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
          <img src={nicoLogo} alt='NICO' />
        </div>

        <form className='login-form' onSubmit={handleLoginSubmit}>
          {loginError ? (
            <Alert
              className='login-alert'
              type='error'
              message={loginError}
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
              placeholder='Enter username'
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

          <button className='login-link' type='button'>
            Forgot password?
          </button>

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

          <div className='login-divider'>
            <span>or</span>
          </div>

          <p className='login-signup'>
            Don&apos;t have an account? <strong>Sign up</strong>
          </p>
        </form>

        <div className='login-footer-logo'>
          <img src={inlandLogo} alt='Inland' />
        </div>
      </section>
    </main>
  );
}

export default Login;
