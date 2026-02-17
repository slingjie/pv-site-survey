import React from 'react';

interface RadioOption<T> {
  value: T;
  label: string;
}

interface RadioGroupProps<T> {
  options: RadioOption<T>[];
  selected: T;
  onChange: (value: T) => void;
  name: string;
  disabled?: boolean;
}

const RadioGroup = <T extends string | number | boolean,>({ options, selected, onChange, name, disabled = false }: RadioGroupProps<T>) => (
  <div className="flex space-x-6">
    {options.map((option) => (
      <label key={String(option.value)} className={`flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={name}
          value={String(option.value)}
          checked={selected === option.value}
          onChange={() => onChange(option.value)}
          disabled={disabled}
          className="hidden"
        />
        <span
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
            selected === option.value ? (disabled ? 'border-gray-300' : 'border-yellow-500') : 'border-gray-300'
          }`}
        >
          {selected === option.value && <span className={`w-2.5 h-2.5 rounded-full ${disabled ? 'bg-gray-300' : 'bg-yellow-500'}`}></span>}
        </span>
        <span className={`ml-2 text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{option.label}</span>
      </label>
    ))}
  </div>
);

export default RadioGroup;