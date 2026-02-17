import React, { useState } from 'react';
import type { ElectricalFacilitiesData, SubFacility } from '../../types';
import { electricalModuleConfig, subFacilityConfig, enums } from '../../services/formConfigs';
import { Plus, X, Zap } from '../icons';
import FormField from '../common/FormField';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import PickerField from '../common/PickerField';
import Chip from '../common/Chip';
import ImageUploadCard from '../common/ImageUploadCard';
import ImagePreviewModal from '../common/ImagePreviewModal';
import { compressImageFile } from '../common/imageUtils';

interface ElectricalFacilitiesProps {
  data: ElectricalFacilitiesData;
  onDataChange: (updatedData: ElectricalFacilitiesData) => void;
  isEditing: boolean;
}

interface DynamicFieldProps {
  field: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    enumKey?: string;
    placeholder?: string;
  };
  value: any;
  onChange: (value: any) => void;
  onPreview: (imageUrl: string) => void;
  isEditing: boolean;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange, onPreview, isEditing }) => {
  const commonProps = {
    label: field.label,
    required: field.required,
    disabled: !isEditing,
  };

  switch (field.type) {
    case 'text':
      return (
        <FormField {...commonProps}>
          <TextInput value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={!isEditing}/>
        </FormField>
      );
    case 'textarea':
      return (
        <FormField {...commonProps}>
          <TextArea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={!isEditing}/>
        </FormField>
      );
    case 'select':
      return (
        <PickerField
          {...commonProps}
          value={value}
          onSelect={onChange}
          options={enums[field.enumKey]}
          placeholder={`请选择${field.label}`}
        />
      );
    case 'chips':
      const handleToggle = (chipValue: string) => {
        const currentValues = Array.isArray(value) ? value : [];
        const newValues = currentValues.includes(chipValue)
          ? currentValues.filter(v => v !== chipValue)
          : [...currentValues, chipValue];
        onChange(newValues);
      };
      return (
        <FormField {...commonProps}>
          <div className="flex flex-wrap gap-2">
            {enums[field.enumKey].map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={Array.isArray(value) && value.includes(opt.value)}
                onClick={() => handleToggle(opt.value)}
                disabled={!isEditing}
              />
            ))}
          </div>
        </FormField>
      );
    case 'image':
      const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const compressed = await compressImageFile(file);
          onChange(compressed);
        } catch (err) {
          console.error('图片压缩失败，回退为原图：', err);
          const reader = new FileReader();
          reader.onload = (event) => {
            onChange(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      return (
        <FormField {...commonProps}>
          <ImageUploadCard
            title={`上传${field.label}`}
            image={value}
            disabled={!isEditing}
            onUpload={handleUpload}
            onClick={() => value && onPreview(value)}
          />
        </FormField>
      );
    default:
      return <p>未知字段类型: {field.type}</p>;
  }
};

const ElectricalFacilities: React.FC<ElectricalFacilitiesProps> = ({ data, onDataChange, isEditing }) => {
  const [activeSectionKey, setActiveSectionKey] = useState<string>(electricalModuleConfig.sections[0].key);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const activeSection = electricalModuleConfig.sections.find(s => s.key === activeSectionKey);

  const handleFieldChange = (key: keyof ElectricalFacilitiesData, value: any) => {
    onDataChange({ ...data, [key]: value });
  };

  const handleSubFacilityChange = (subFacilityId: string, key: keyof SubFacility, value: any) => {
      const updatedSubFacilities = data.subFacilities.map(sf => 
        sf.id === subFacilityId ? { ...sf, [key]: value } : sf
      );
      onDataChange({ ...data, subFacilities: updatedSubFacilities });
  };
  
  const addSubFacility = () => {
      const newId = `subfacility-${Date.now()}`;
      const newSubFacility: SubFacility = {
          id: newId,
          name: `${data.subFacilities.length + 1}#设施`,
          roomImage: null, transformerImage: null, singleLineImage: null,
          panelImage: null, meterImage: null, envImage: null,
      };
      onDataChange({ ...data, subFacilities: [...data.subFacilities, newSubFacility] });
  };

  const removeSubFacility = (idToRemove: string) => {
    const updatedSubFacilities = data.subFacilities
        .filter(sf => sf.id !== idToRemove)
        .map((sf, index) => ({ ...sf, name: `${index + 1}#设施`})); // Re-number names
    onDataChange({ ...data, subFacilities: updatedSubFacilities });
  };


  const renderSectionContent = () => {
    if (!activeSection) return null;

    if (activeSection.key === 'subFacilities') {
        return (
            <div className="space-y-6">
                {data.subFacilities.map(subFacility => (
                    <div key={subFacility.id} className="bg-white rounded-lg shadow p-4 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-medium text-gray-800">{subFacility.name}</h4>
                            {isEditing && (
                                <button
                                    onClick={() => removeSubFacility(subFacility.id)}
                                    className="p-1 text-red-500 hover:bg-red-100 rounded-full"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {subFacilityConfig.fields.map(field => (
                                <DynamicField
                                    key={field.key}
                                    field={field}
                                    value={subFacility[field.key as keyof SubFacility]}
                                    onChange={value => handleSubFacilityChange(subFacility.id, field.key as keyof SubFacility, value)}
                                    onPreview={setPreviewImage}
                                    isEditing={isEditing}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {isEditing && (
                    <button
                        onClick={addSubFacility}
                        className="w-full h-12 flex items-center justify-center space-x-2 border-2 border-dashed border-gray-400 text-gray-600 rounded-lg hover:border-yellow-500 hover:text-yellow-600 transition"
                    >
                        <Plus size={20} />
                        <span>添加分项设施</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
            {activeSection.fields.map(field => (
                <DynamicField
                    key={field.key}
                    field={field}
                    value={data[field.key as keyof ElectricalFacilitiesData]}
                    onChange={(value) => handleFieldChange(field.key as keyof ElectricalFacilitiesData, value)}
                    onPreview={setPreviewImage}
                    isEditing={isEditing}
                />
            ))}
        </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Left Vertical Menu */}
      <div className="w-24 flex-shrink-0 bg-white border-r border-gray-200">
        {electricalModuleConfig.sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSectionKey(section.key)}
            className={`w-full h-16 flex items-center justify-center text-xs text-center font-medium border-l-4 transition ${
              activeSectionKey === section.key
                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            {section.title}
          </button>
        ))}
      </div>
      {/* Right Form Content */}
      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
        {renderSectionContent()}
      </div>
      {previewImage && (
        <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
};

export default ElectricalFacilities;
