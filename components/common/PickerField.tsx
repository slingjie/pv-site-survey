import React, { useState } from 'react';
import FormField from './FormField';
import BottomSheetPicker from './BottomSheetPicker';
import { ChevronRight } from '../icons';

type Option = string | { value: any; label: string };

interface PickerFieldProps {
  label: string;
  required?: boolean;
  value: any;
  placeholder: string;
  options: Option[];
  title?: string;
  onSelect: (value: any) => void;
  disabled?: boolean;
}

const PickerField: React.FC<PickerFieldProps> = ({ label, required, value, placeholder, options, title, onSelect, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const displayValue = options.find(opt => (typeof opt === 'object' ? opt.value : opt) === value);
  const displayLabel = typeof displayValue === 'object' ? (displayValue as { label: string }).label : displayValue;

  return (
    <FormField label={label} required={required}>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="w-full h-12 px-3 py-3 bg-white border border-gray-300 rounded-lg shadow-sm flex justify-between items-center text-left disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className={displayLabel ? "text-gray-900" : "text-gray-400"}>
          {displayLabel || placeholder}
        </span>
        <ChevronRight size={18} className="text-gray-400" />
      </button>
      {isOpen && !disabled && (
        <BottomSheetPicker
          title={title || `请选择${label}`}
          options={options}
          selectedValue={value}
          onSelect={(val) => {
            onSelect(val);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </FormField>
  );
};

export default PickerField;