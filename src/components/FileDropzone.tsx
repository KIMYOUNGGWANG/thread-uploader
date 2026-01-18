"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
    onFileSelect: (file: File) => void;
    isLoading?: boolean;
}

export function FileDropzone({ onFileSelect, isLoading }: FileDropzoneProps) {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragActive(true);
        } else if (e.type === "dragleave") {
            setIsDragActive(false);
        }
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(false);

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                if (isValidFile(file)) {
                    onFileSelect(file);
                }
            }
        },
        [onFileSelect]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (isValidFile(file)) {
                    onFileSelect(file);
                }
            }
        },
        [onFileSelect]
    );

    const isValidFile = (file: File): boolean => {
        const validTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/markdown",
            "text/plain",
        ];
        const validExtensions = [".xlsx", ".md"];

        return (
            validTypes.includes(file.type) ||
            validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
        );
    };

    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center w-full min-h-[300px] p-8",
                "border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer",
                "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800",
                isDragActive
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 scale-[1.02]"
                    : "border-slate-300 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600",
                isLoading && "opacity-50 pointer-events-none"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                type="file"
                accept=".xlsx,.md"
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading}
            />

            <div className="flex flex-col items-center gap-4">
                <div
                    className={cn(
                        "p-4 rounded-full transition-all duration-300",
                        "bg-gradient-to-br from-violet-500 to-purple-600",
                        "shadow-lg shadow-violet-500/30",
                        isDragActive && "scale-110 shadow-xl shadow-violet-500/50"
                    )}
                >
                    <Upload className="w-8 h-8 text-white" />
                </div>

                <div className="text-center">
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                        {isDragActive ? "Drop your file here" : "Drag & drop your file"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        or click to browse
                    </p>
                </div>

                <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <FileSpreadsheet className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">.xlsx</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">.md</span>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-2xl">
                    <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}
