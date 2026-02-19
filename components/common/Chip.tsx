import React from 'react';
import { Plus, X } from '../icons';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  canAdd?: boolean;
  disabled?: boolean;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onClick, onRemove, canAdd = false, disabled = false }) => {
  if (canAdd) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center justify-center h-8 px-3 text-sm text-gray-600 bg-gray-100 border border-dashed border-gray-400 rounded-full transition hover:bg-gray-200 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <Plus size={16} className="mr-1" /> {label}
      </button>
    );
  }

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`relative h-7 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${
        disabled
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'cursor-pointer'
      } ${
        selected
          ? 'bg-yellow-100 border border-yellow-500 text-gray-900'
          : 'bg-gray-100 border border-transparent text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) onRemove(); }}
          disabled={disabled}
          className="ml-1.5 -mr-1 p-0.5 rounded-full hover:bg-red-200 text-red-500 disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default Chip;