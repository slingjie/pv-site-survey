import React, { useState, useEffect } from "react";
import ReportEditor from "./components/views/ReportEditor";
import HomePage from "./components/views/HomePage";
import NewProjectPage from "./components/views/NewProjectPage";
import type { ReportData, Project } from "./types";
import { getInitialMockData } from "./services/mockData";
import { Smartphone, Monitor } from "./components/icons";
import {
  createProjectWithReport,
  deleteProjectRemote,
  getProjectWithReport,
  listProjects,
  saveProjectWithReport,
  updateProjectStatusRemote,
} from "./services/projectApi";
import SyncIndicator from "./components/SyncIndicator";
import { trySync } from "./services/sync";

export default function App() {
  const [currentView, setCurrentView] = useState<
    "home" | "new" | "editor"
  >("home");
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [isNewProject, setIsNewProject] = useState(false);
  const [isMobileView, setIsMobileView] = useState(true); // Default to mobile view for safety

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsData, setProjectsData] = useState<{
    [key: string]: ReportData;
  }>({});
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsMobileView(false);
    }

    listProjects()
      .then((list) => setProjects(list))
      .catch((e) => console.error("加载项目列表失败：", e))
      .finally(() => setInitializing(false));

    trySync();
  }, []);

  const handleSelectProject = async (reportId: string) => {
    setIsNewProject(false);
    setCurrentReportId(reportId);

    if (projectsData[reportId]) {
      setCurrentView("editor");
      return;
    }

    try {
      const { project, reportData } = await getProjectWithReport(reportId);
      setProjects((prev) =>
        prev.map((p) => (p.id === reportId ? { ...p, ...project } : p)),
      );
      setProjectsData((prev) => ({ ...prev, [reportId]: reportData }));
    } catch (e) {
      console.error("加载项目失败：", e);
      alert("从服务器加载项目失败，请稍后再试。");
      return;
    }

    setCurrentView("editor");
  };

  const handleNavigateToNew = () => {
    setCurrentView("new");
  };

  const handleCreateNewProject = async (payload: {
    name: string;
    location: string;
    surveyDate: string;
    surveyors: string;
    projectType: NonNullable<Project["projectType"]>;
  }) => {
    const { name, location, surveyDate, surveyors, projectType } = payload;
    const newId = `TK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;

    const newProject: Project = {
      id: newId,
      name,
      location,
      status: "editing",
      surveyDate,
      surveyors,
      projectType,
    };

    const newReportData = getInitialMockData({
      reportId: newId,
      projectName: name,
      location: location,
    });

    try {
      await createProjectWithReport(newProject, newReportData);
    } catch (e) {
      console.error("创建项目失败：", e);
      alert("创建项目失败，请稍后重试。");
      return;
    }

    setProjects((prevProjects) => [...prevProjects, newProject]);
    setProjectsData((prevData) => ({ ...prevData, [newId]: newReportData }));

    setIsNewProject(true);
    setCurrentReportId(newId);
    setCurrentView("editor");
  };

  const handleCancelNew = () => {
    setCurrentView("home");
  };

  const handleSaveReport = async (
    reportId: string,
    updatedReportData: ReportData,
  ) => {
    setProjectsData((prevData) => ({
      ...prevData,
      [reportId]: updatedReportData,
    }));

    let targetProject: Project | undefined;
    setProjects((prevProjects) =>
      prevProjects.map((p) =>
        p.id === reportId
          ? {
              ...p,
              name: updatedReportData.projectName,
              location: updatedReportData.location,
            }
          : p,
      ),
    );

    targetProject = projects.find((p) => p.id === reportId);

    try {
      const current =
        targetProject || projects.find((p) => p.id === reportId);
      if (!current) throw new Error("project not found in state");

      const updatedProject: Project = {
        ...current,
        name: updatedReportData.projectName,
        location: updatedReportData.location,
      };

      const savedReport = await saveProjectWithReport(
        updatedProject,
        updatedReportData,
      );

      setProjectsData((prev) => ({ ...prev, [reportId]: savedReport }));
      setProjects((prev) =>
        prev.map((p) => (p.id === reportId ? updatedProject : p)),
      );
    } catch (e) {
      console.error("保存报告到服务器失败：", e);
      alert("保存到服务器失败，本地修改已生效，但请稍后重试同步。");
    }
  };

  const handleCloseReport = () => {
    setCurrentView("home");
    setCurrentReportId(null);
    setIsNewProject(false);
  };

  // 更新项目状态（踏勘中 / 已完成）
  const handleUpdateProjectStatus = (
    projectId: string,
    status: Project["status"],
  ) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status } : p)),
    );

    updateProjectStatusRemote(projectId, status).catch((e) => {
      console.error("更新项目状态失败：", e);
    });
  };

  // 删除项目：从项目列表和报告数据中移除，若当前正在查看则返回首页
  const handleDeleteProject = (projectId: string) => {
    if (!window.confirm("确定要删除该项目及其踏勘报告吗？此操作不可恢复。")) {
      return;
    }

    deleteProjectRemote(projectId).catch((e) => {
      console.error("删除项目时调用后端失败：", e);
    });

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setProjectsData((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });

    if (currentReportId === projectId) {
      handleCloseReport();
    }
  };

  const renderContent = () => {
    if (initializing) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          正在加载项目数据...
        </div>
      );
    }

    if (currentView === "editor" && currentReportId) {
      const reportData = projectsData[currentReportId];
      const currentProject = projects.find((p) => p.id === currentReportId);
      if (!reportData || !currentProject) {
        handleCloseReport();
        return null;
      }
      return (
        <ReportEditor
          reportId={currentReportId}
          initialData={reportData}
          onClose={handleCloseReport}
          onSave={handleSaveReport}
          startInEditMode={isNewProject}
          isMobileView={isMobileView}
          projectStatus={currentProject.status}
          onUpdateProjectStatus={handleUpdateProjectStatus}
          onDeleteProject={handleDeleteProject}
          projectSurveyDate={currentProject.surveyDate}
          projectSurveyors={currentProject.surveyors}
          projectType={currentProject.projectType}
        />
      );
    }

    if (currentView === "new") {
      return (
        <NewProjectPage
          onCancel={handleCancelNew}
          onCreate={handleCreateNewProject}
        />
      );
    }

    return (
      <HomePage
        projects={projects}
        onSelectProject={handleSelectProject}
        onCreateNew={handleNavigateToNew}
        onDeleteProject={handleDeleteProject}
        isMobileView={isMobileView}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start pt-0 md:pt-0 transition-all">
      <div
        className={`bg-white w-full min-h-screen md:h-[90vh] transition-all duration-300 shadow-2xl ${
          isMobileView
            ? "max-w-md border-x border-gray-200 my-0 md:my-8 md:rounded-3xl"
            : "max-w-full"
        }`}
      >
        {renderContent()}
      </div>

      {/* View Toggle Floating Button */}
      <button
        onClick={() => setIsMobileView(!isMobileView)}
        className="fixed bottom-6 right-6 safe-area-margin-bottom z-50 p-4 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center"
        title={isMobileView ? "切换到电脑视图" : "切换到手机视图"}
      >
        {isMobileView ? <Monitor size={24} /> : <Smartphone size={24} />}
      </button>

      <SyncIndicator />
    </div>
  );
}
