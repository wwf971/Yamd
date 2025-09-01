import React from 'react';
import './Footer.css';

/**
 * Footer Component
 * Reusable footer component that can be used across different pages
 * 
 * Props:
 * - className: string (optional) - Additional CSS class for styling
 * - text: string (optional) - Custom footer text, defaults to construction message
 * - showLinks: boolean (optional) - Whether to show additional links, defaults to false
 */
function Footer({ 
  className = '', 
  text = 'This website is under construction. This website is created using React.js/Zustand and flask/nginx.',
  showLinks = false 
}) {
  return (
    <div className={`footer ${className}`}>
      <span className="footer-text">
        {text}
      </span>
      {showLinks && (
        <div className="footer-links">
          {/* Add any additional footer links here if needed */}
        </div>
      )}
    </div>
  );
}

export default Footer;
