'use client';

import React, { useState, useRef, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
}

const OTPInput: React.FC<OTPInputProps> = ({ 
  length = 6, 
  value, 
  onChange,
  onComplete 
}) => {
  const [activeInput, setActiveInput] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Initialize input references
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto-focus on first empty input
  useEffect(() => {
    const firstEmptyIndex = value.split('').findIndex((v, i) => i >= value.length);
    const indexToFocus = firstEmptyIndex !== -1 ? firstEmptyIndex : value.length - 1;
    
    const input = inputRefs.current[indexToFocus >= 0 ? indexToFocus : 0];
    if (input) {
      setTimeout(() => {
        input.focus();
      }, 0);
    }
  }, []);

  // Check if all inputs are filled
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete();
    }
  }, [value, length, onComplete]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value;
    
    // Only allow digits
    if (!/^\d*$/.test(newValue)) {
      return;
    }
    
    // Handle pasting multiple digits
    if (newValue.length > 1) {
      const pastedValue = newValue.split('');
      // Fill as many inputs as we can with the pasted value
      const updatedValue = value.split('');
      
      for (let i = 0; i < length; i++) {
        if (i >= index && pastedValue.length > 0) {
          updatedValue[i] = pastedValue.shift() || '';
        }
      }
      
      const finalValue = updatedValue.join('').substring(0, length);
      onChange(finalValue);
      
      // Check if we should trigger completion
      if (finalValue.length === length && onComplete) {
        onComplete();
      }
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(index + newValue.length, length - 1);
      setActiveInput(nextIndex);
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
        inputRefs.current[nextIndex]?.select();
      }, 0);
      
      return;
    }
    
    // Handle single digit input
    const updatedValue = value.split('');
    updatedValue[index] = newValue.substring(0, 1);
    
    const finalValue = updatedValue.join('').substring(0, length);
    onChange(finalValue);
    
    // Auto-advance to next input
    if (newValue !== '' && index < length - 1) {
      setActiveInput(index + 1);
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 0);
    }
  };

  // Handle backspace
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // Move to previous input on backspace if current input is empty
      setActiveInput(index - 1);
      setTimeout(() => {
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }, 0);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      // Move left
      setActiveInput(index - 1);
      setTimeout(() => {
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }, 0);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      // Move right
      setActiveInput(index + 1);
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
        inputRefs.current[index + 1]?.select();
      }, 0);
    }
  };

  // Handle input focus
  const handleFocus = (index: number) => {
    setActiveInput(index);
  };

  // Handle clicking on an input
  const handleClick = (index: number) => {
    setActiveInput(index);
    inputRefs.current[index]?.select();
  };

  // Create input elements
  const inputs = [];
  for (let i = 0; i < length; i++) {
    const char = value[i] || '';
    inputs.push(
      <input
        key={i}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={1}
        ref={(el) => {
          inputRefs.current[i] = el;
        }}
        value={char}
        onChange={(e) => handleChange(e, i)}
        onKeyDown={(e) => handleKeyDown(e, i)}
        onFocus={() => handleFocus(i)}
        onClick={() => handleClick(i)}
        className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-md mx-1 
                    bg-slate-800 text-white
                    focus:border-pink-500 focus:ring-2 focus:ring-pink-200/20 focus:outline-none
                    ${activeInput === i ? 'border-pink-500' : 'border-slate-700'}`}
        aria-label={`digit ${i + 1}`}
      />
    );
  }

  return (
    <div className="flex justify-center items-center">
      {inputs}
    </div>
  );
};

export default OTPInput; 