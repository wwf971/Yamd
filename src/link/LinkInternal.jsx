import React from 'react';
import { Link } from 'react-router-dom';

const LinkInternal = ({ to, children, style = {}, ...props }) => {
  const defaultStyle = {
    color: '#1976d2',
    textDecoration: 'none',
    padding: '5px 10px',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #1976d2',
    ...style // Allow custom styles to override defaults
  };

  return (
    <Link to={to} style={defaultStyle} {...props}>
      {children}
    </Link>
  );
};

export default LinkInternal;
