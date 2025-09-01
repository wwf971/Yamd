import React from 'react';

const BackToHome = ({ 
  to = "/home/", 
  children = "← Back to Home", 
  className = "back-button",
  ...props 
}) => {
  return (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  );
};

export default BackToHome;
