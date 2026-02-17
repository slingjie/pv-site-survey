import React from "react";
import type { Project } from "../../types";
import { MapPin, Plus, X } from "../icons";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  onDelete,
}) => (
  <div
    onClick={onClick}
    className="bg-white p-4 rounded-xl shadow border border-gray-100 cursor-pointer hover:shadow-md transition"
  >
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-base font-semibold text-gray-900 truncate">
        {project.name}
      </h3>
      <div className="flex items-center space-x-2 flex-shrink-0">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${project.status === "editing"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
            }`}
        >
          {project.status === "editing" ? "踏勘中" : "已完成"}
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="删除项目"
        >
          <X size={14} />
        </button>
      </div>
    </div>
    <div className="flex items-center text-sm text-gray-500">
      <MapPin size={14} className="mr-1.5 flex-shrink-0" />
      <span>{project.location}</span>
    </div>
    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
      <span>踏勘日期：{project.surveyDate || "未填写"}</span>
      <span className="ml-2 truncate">
        踏勘人员：{project.surveyors || "未填写"}
      </span>
    </div>
    {project.projectType && (
      <div className="mt-1 text-xs text-gray-400">
        项目类型：
        {project.projectType === "pv"
          ? "光伏"
          : project.projectType === "storage"
            ? "储能"
            : project.projectType === "pv_storage"
              ? "光储一体"
              : "其他"}
      </div>
    )}
  </div>
);

interface HomePageProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onCreateNew: () => void;
  onDeleteProject: (id: string) => void;
  isMobileView: boolean;
}

const HomePage: React.FC<HomePageProps> = ({
  projects,
  onSelectProject,
  onCreateNew,
  onDeleteProject,
  isMobileView,
}) => (
  <div className="h-full flex flex-col font-sans bg-gray-50">
    <header className="flex-shrink-0 bg-white shadow-sm z-10">
      <div
        className={`h-14 flex items-center justify-between px-4 relative ${isMobileView ? "" : "max-w-7xl mx-auto"}`}
      >
        <div className="flex items-center" />

        <h1 className="text-lg font-medium absolute left-1/2 -translate-x-1/2">我的项目</h1>

        <button
          onClick={onCreateNew}
          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-full transition"
        >
          <Plus size={24} />
        </button>
      </div>
    </header>

    <main
      className={`flex-1 overflow-y-auto p-4 ${isMobileView ? "space-y-4" : "max-w-7xl mx-auto w-full"}`}
    >
      <div
        className={
          isMobileView
            ? "space-y-4"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        }
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onSelectProject(project.id)}
            onDelete={() => onDeleteProject(project.id)}
          />
        ))}
      </div>
    </main>
  </div>
);

export default HomePage;
