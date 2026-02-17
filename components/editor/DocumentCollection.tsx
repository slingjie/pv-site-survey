
import React from 'react';
import type { DocumentCollectionData, DocumentStatus } from '../../types';
import { documentCollectionConfig } from '../../services/formConfigs'; // Import centralized config

interface DocumentCollectionProps {
  data: DocumentCollectionData;
  onDataChange: (updatedData: DocumentCollectionData) => void;
  isEditing: boolean;
}

const DocumentCollection: React.FC<DocumentCollectionProps> = ({ data, onDataChange, isEditing }) => {
  const statuses: { value: DocumentStatus; label: string }[] = [
    { value: 'full', label: '齐全' },
    { value: 'partial', label: '部分' },
    { value: 'pending', label: '待收' },
    { value: 'none', label: '无法提供' },
  ];
  
  const handleStatusChange = (key: string, value: DocumentStatus) => {
    onDataChange({
      ...data,
      [key]: value
    });
  };

  return (
    <div className="p-4 overflow-y-auto h-full bg-gray-50">
      {documentCollectionConfig.sections.map(section => (
        <div key={section.title} className="mb-6 bg-white rounded-lg shadow p-4">
          <h3 className="text-base font-medium mb-4 text-gray-800">{section.title}</h3>
          <div className="space-y-4">
            {section.items.map(item => (
              <div key={item.key}>
                <label className="text-sm text-gray-700 mb-2 block">{item.label}</label>
                <div className="grid grid-cols-4 gap-2">
                  {statuses.map(status => {
                    const isSelected = data[item.key] === status.value;
                    return (
                      <button
                        key={status.value}
                        onClick={() => handleStatusChange(item.key, status.value)}
                        disabled={!isEditing}
                        className={`h-10 text-xs font-medium rounded-md transition border ${
                          isSelected
                            ? `bg-yellow-500 border-yellow-500 text-white shadow ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`
                            : `bg-gray-100 border-transparent text-gray-600 ${isEditing ? 'hover:bg-gray-200' : 'text-gray-400 cursor-not-allowed'}`
                        }`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentCollection;
