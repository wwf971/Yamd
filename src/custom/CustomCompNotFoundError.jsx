import React from 'react';

const CustomCompNotFoundError = ({ nodeData }) => {
  const customType = nodeData?.attr?.customType || 'unknown';
  return (
    <div className="yamd-custom-comp-not-found">
      Custom component not found: {customType}
    </div>
  );
};

export default CustomCompNotFoundError;