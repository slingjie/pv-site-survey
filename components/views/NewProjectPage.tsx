import React, { useState } from "react";
import FormField from "../common/FormField";
import TextInput from "../common/TextInput";
import { X } from "../icons";
import type { Project } from "../../types";

type NewProjectPayload = {
  name: string;
  location: string;
  surveyDate: string;
  surveyors: string;
  projectType: NonNullable<Project["projectType"]>;
};

interface NewProjectPageProps {
  onCancel: () => void;
  onCreate: (payload: NewProjectPayload) => void;
}

const NewProjectPage: React.FC<NewProjectPageProps> = ({
  onCancel,
  onCreate,
}) => {
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState("");
  const [surveyDate, setSurveyDate] = useState("");
  const [surveyors, setSurveyors] = useState("");
  const [projectType, setProjectType] =
    useState<NonNullable<Project["projectType"]>>("pv");

  const handleCreate = () => {
    if (
      !projectName.trim() ||
      !location.trim() ||
      !surveyDate ||
      !surveyors.trim()
    ) {
      alert("请输入项目名称、所在地区、踏勘日期和踏勘人员");
      return;
    }

    onCreate({
      name: projectName.trim(),
      location: location.trim(),
      surveyDate,
      surveyors: surveyors.trim(),
      projectType,
    });
  };

  const projectTypeOptions: {
    value: NonNullable<Project["projectType"]>;
    label: string;
  }[] = [
    { value: "pv", label: "光伏" },
    { value: "storage", label: "储能" },
    { value: "pv_storage", label: "光储一体" },
    { value: "other", label: "其他" },
  ];

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-50 flex flex-col font-sans">
      <header className="flex-shrink-0 bg-white shadow-sm z-10">
        <div className="h-14 flex items-center justify-between px-4 relative">
          <button className="p-2 text-gray-600" onClick={onCancel}>
            <X size={24} />
          </button>
          <h1 className="text-lg font-medium">新建踏勘项目</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <FormField label="项目名称" required>
          <TextInput
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="请输入项目名称"
          />
        </FormField>
        <FormField label="所在地区" required>
          <TextInput
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="请输入省/市/区"
          />
        </FormField>
        <FormField label="踏勘日期" required>
          <TextInput
            type="date"
            value={surveyDate}
            onChange={(e) => setSurveyDate(e.target.value)}
            placeholder="请选择踏勘日期"
          />
        </FormField>
        <FormField label="踏勘人员" required>
          <TextInput
            value={surveyors}
            onChange={(e) => setSurveyors(e.target.value)}
            placeholder="请输入踏勘人员，如：张三、李四"
          />
        </FormField>
        <FormField label="项目类型" required>
          <div className="flex flex-wrap gap-2">
            {projectTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProjectType(opt.value)}
                className={`px-3 py-2 rounded-full text-sm border transition ${
                  projectType === opt.value
                    ? "bg-yellow-500 text-gray-900 border-yellow-500 shadow"
                    : "bg-white text-gray-700 border-gray-300 hover:border-yellow-400 hover:text-yellow-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormField>
      </main>

      <footer className="flex-shrink-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleCreate}
          className="h-12 w-full rounded-full bg-yellow-500 text-gray-900 font-medium text-base flex items-center justify-center space-x-2 shadow"
        >
          <span>创建项目</span>
        </button>
      </footer>
    </div>
  );
};

export default NewProjectPage;
