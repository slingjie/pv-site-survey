import React, { useState } from 'react';
import type { BuildingRoof } from '../../types';
import { roofModuleConfig, enums } from '../../services/formConfigs';
import { Building, Plus, X } from '../icons';
import FormField from '../common/FormField';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import PickerField from '../common/PickerField';
import Chip from '../common/Chip';
import ImageUploadCard from '../common/ImageUploadCard';
import { compressImageFile } from '../common/imageUtils';
import ImagePreviewModal from '../common/ImagePreviewModal';

interface BuildingRoofsProps {
  data: BuildingRoof[];
  onDataChange: (updatedData: BuildingRoof[]) => void;
  isEditing: boolean;
}

interface DynamicFieldProps {
  field: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    enumKey?: string;
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
          <TextInput value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={!isEditing}/>
        </FormField>
      );
    case 'number':
       return (
        <FormField {...commonProps}>
            <TextInput type="number" value={value || ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} disabled={!isEditing}/>
        </FormField>
      );
    case 'textarea':
      return (
        <FormField {...commonProps}>
          <TextArea value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={!isEditing}/>
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


const BuildingRoofs: React.FC<BuildingRoofsProps> = ({ data, onDataChange, isEditing }) => {
  const [activeRoofId, setActiveRoofId] = useState<string | null>(data[0]?.id || null);
  const [activeSectionKey, setActiveSectionKey] = useState<string>(roofModuleConfig.sections[0].key);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const activeRoof = data.find(roof => roof.id === activeRoofId);
  const activeSection = roofModuleConfig.sections.find(s => s.key === activeSectionKey);

  const addRoof = () => {
    const newRoofId = `roof-${Date.now()}`;
    const newRoof: BuildingRoof = {
      id: newRoofId,
      name: `屋顶-${data.length + 1}`,
      area: 0, type: 'color_steel_tile', capacity: 0, birdView: null, orientation: 'south',
      coordinates: null,
      utilization: 'few_obstacles', obstacleTypes: [], obstacleImage: null, pollutionLevel: 'general', pollutionImage: null,
      structureType: 'steel_structure', structureImage: null, abnormalTypes: [], abnormalImage: null, abnormalDescription: '',
      surroundingDescription: '', surroundingImage: null,
    };
    onDataChange([...data, newRoof]);
    setActiveRoofId(newRoofId);
  };
  
  const removeRoof = (idToRemove: string) => {
    const updatedRoofs = data.filter(roof => roof.id !== idToRemove);
    onDataChange(updatedRoofs);
    if (activeRoofId === idToRemove) {
      const newActiveId = updatedRoofs[0]?.id || null;
      setActiveRoofId(newActiveId);
      if (newActiveId === null) {
          setActiveSectionKey(roofModuleConfig.sections[0].key);
      }
    }
  };

  const handleFieldChange = (key: keyof BuildingRoof, value: any) => {
    if (!activeRoof) return;
    const updatedRoofs = data.map(roof => 
        roof.id === activeRoofId ? { ...roof, [key]: value } : roof
    );
    onDataChange(updatedRoofs);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-3 bg-white border-b border-gray-200 flex items-center space-x-2 overflow-x-auto">
        {data.map(roof => (
          <div
            key={roof.id}
            onClick={() => setActiveRoofId(roof.id)}
            className={`relative h-10 px-4 py-2 rounded-full text-sm font-medium cursor-pointer flex-shrink-0 ${
              activeRoofId === roof.id
                ? 'bg-yellow-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {roof.name}
             {data.length > 1 && isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeRoof(roof.id); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <X size={12} />
                </button>
              )}
          </div>
        ))}
        <button
          onClick={addRoof}
          disabled={!isEditing}
          className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 hover:bg-yellow-200 hover:text-yellow-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
        </button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {activeRoof && activeSection ? (
            <>
                {/* Left Vertical Menu */}
                <div className="w-24 flex-shrink-0 bg-white border-r border-gray-200">
                    {roofModuleConfig.sections.map((section) => (
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
                    <div className="bg-white rounded-lg shadow p-4 space-y-4">
                        {activeSection.fields.map(field => (
                           <DynamicField
                                key={field.key}
                                field={field}
                                value={activeRoof[field.key as keyof BuildingRoof]}
                                onChange={(value) => handleFieldChange(field.key as keyof BuildingRoof, value)}
                                onPreview={setPreviewImage}
                                isEditing={isEditing}
                            />
                        ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="w-full flex-1 text-center p-10 text-gray-500 flex flex-col justify-center items-center">
                <Building size={40} className="mx-auto mb-4" />
                <p>请添加一个屋顶开始编辑。</p>
            </div>
        )}
      </div>
      {previewImage && (
        <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
};

export default BuildingRoofs;
