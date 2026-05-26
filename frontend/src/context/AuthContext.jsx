import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set default authorization header for axios when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      
      // Fetch user profile if not loaded
      if (!user) {
        axios.get('/api/auth/me')
          .then(res => {
            if (res.data.success) {
              setUser(res.data.data);
            } else {
              logout();
            }
          })
          .catch(() => {
            logout();
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      if (response.data.success) {
        setToken(response.data.data.token);
        setUser({
          _id: response.data.data._id,
          name: response.data.data.name,
          email: response.data.data.email,
          role: response.data.data.role
        });
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid credentials or server error'
      };
    }
  };

  const register = async (name, email, password, role = 'teacher') => {
    try {
      const response = await axios.post('/api/auth/register', { name, email, password, role });
      if (response.data.success) {
        setToken(response.data.data.token);
        setUser({
          _id: response.data.data._id,
          name: response.data.data.name,
          email: response.data.data.email,
          role: response.data.data.role
        });
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Registration failed' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Email already exists or invalid data'
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
