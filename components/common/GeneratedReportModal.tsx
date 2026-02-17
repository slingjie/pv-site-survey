import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, Printer } from "../icons";
import type { ReportData } from "../../types";

interface GeneratedReportModalProps {
  reportContent: string; // Now expecting an HTML string
  rawReportData: ReportData;
  onClose: () => void;
  /** 是否为手机视图，用于调整预览宽度 */
  isMobileView?: boolean;
}

const GeneratedReportModal: React.FC<GeneratedReportModalProps> = ({
  reportContent,
  rawReportData,
  onClose,
  isMobileView = false,
}) => {
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(JSON.stringify(rawReportData, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy data: ", err);
        alert("复制失败!");
      });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "", "height=800,width=800");
    if (printWindow) {
      printWindow.document.write("<html><head><title>勘探报告</title>");
      // It's crucial to include the styles in the new window
      printWindow.document.write("</head><body>");
      printWindow.document.write(reportContent);
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.print();
    } else {
      alert("无法打开打印窗口，请检查浏览器设置。");
    }
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full h-[90vh] flex flex-col overflow-hidden ${
          isMobileView ? "max-w-md" : "max-w-5xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium">勘探报告预览</h2>
          <button
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <main ref={reportRef} className="flex-1 p-4 overflow-y-auto bg-gray-50">
          {/* Render the HTML report content */}
          <div
            className={
              isMobileView ? "max-w-full mx-auto" : "max-w-4xl mx-auto"
            }
            dangerouslySetInnerHTML={{ __html: reportContent }}
          />
        </main>

        <footer className="flex-shrink-0 p-4 border-t border-gray-200 grid grid-cols-2 gap-4">
          <button
            onClick={handleCopy}
            className="h-12 w-full rounded-full border-2 border-yellow-500 text-yellow-600 font-medium text-base flex items-center justify-center space-x-2"
          >
            {copied ? (
              <>
                <Check size={18} />
                <span>已复制!</span>
              </>
            ) : (
              <>
                <Copy size={18} />
                <span>复制JSON数据</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="h-12 w-full rounded-full bg-yellow-500 text-gray-900 font-medium text-base flex items-center justify-center space-x-2 shadow"
          >
            <Printer size={18} />
            <span>打印 / 另存为PDF</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default GeneratedReportModal;
