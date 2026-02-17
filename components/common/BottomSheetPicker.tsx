
import React from 'react';

type Option = string | { value: any; label: string };

interface BottomSheetPickerProps {
  title: string;
  options: Option[];
  selectedValue: any;
  onSelect: (value: any) => void;
  onClose: () => void;
}

const BottomSheetPicker: React.FC<BottomSheetPickerProps> = ({ title, options, selectedValue, onSelect, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
    <div
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl shadow-lg z-50 animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-center">{title}</h3>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {options.map((option, index) => {
          const value = typeof option === 'object' ? option.value : option;
          const label = typeof option === 'object' ? option.label : option;
          const isSelected = value === selectedValue;
          
          return (
            <div
              key={index}
              onClick={() => onSelect(value)}
              className={`h-12 flex items-center justify-center text-base ${
                isSelected ? 'text-yellow-600 font-medium' : 'text-gray-800'
              } hover:bg-gray-50 cursor-pointer`}
            >
              {label}
            </div>
          );
        })}
      </div>
      <div className="p-4 grid grid-cols-2 gap-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="h-12 rounded-full bg-gray-100 text-gray-800 font-medium text-base"
        >
          取消
        </button>
        <button
          onClick={onClose}
          className="h-12 rounded-full bg-green-500 text-white font-medium text-base"
        >
          确定
        </button>
      </div>
    </div>
  </div>
);

export default BottomSheetPicker;
