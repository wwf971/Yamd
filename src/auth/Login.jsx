import React, { useState } from 'react';
import axios from 'axios';
import { useNoteStore } from '@/Note.js';
import './Login.css';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginResult, setLoginResult] = useState('');
    const [isLogging, setIsLogging] = useState(false);
    
    const serverUrl = useNoteStore(state => state.serverUrl);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setLoginResult('Please enter both username and password');
            return;
        }

        setIsLogging(true);
        setLoginResult('');

        try {
            const response = await axios.post(serverUrl + '/login', {
                username: username.trim(),
                password: password.trim()
            }, {
                withCredentials: true  // Include cookies in this request
            });

            if (response.data.is_success) {
                setLoginResult('✅ Login success!');
            } else {
                setLoginResult('❌ ' + response.data.message);
            }
        } catch (error) {
            setLoginResult('❌ Login failed: ' + error.message);
        } finally {
            setIsLogging(false);
        }
    };

    return (
        <div className="login-container">
            <h3 className="login-title">Login</h3>
            <div className="login-field">
                <label className="login-label">Username:</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="login-input"
                    placeholder="Enter username"
                />
            </div>

            <div className="login-field-last">
                <label className="login-label">Password:</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    placeholder="Enter password"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isLogging) {
                            handleLogin();
                        }
                    }}
                />
            </div>

            <button
                onClick={handleLogin}
                disabled={isLogging}
                className="login-button"
            >
                {isLogging ? 'Logging in...' : 'Login'}
            </button>

            {loginResult && (
                <div className={`login-result ${loginResult.includes('✅') ? 'login-result-success' : 'login-result-error'}`}>
                    {loginResult}
                </div>
            )}
        </div>
    );
};

export default Login;