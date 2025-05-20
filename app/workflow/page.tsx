'use client';

import AIWorkflow from '@/components/workflow/AIWorkflow';
import { WorkflowProvider } from '@/components/workflow/WorkflowContext';
import { Sparkles } from 'lucide-react';
import React, { useState } from 'react';

export default function WorkflowPage() {
    const [inputValue, setInputValue] = useState('');
    const [showWorkflow, setShowWorkflow] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (e.target.value.includes('工作流测试')) {
            setShowWorkflow(true);
        }
    };

    const handleButtonClick = () => {
        if (inputValue.includes('工作流测试')) {
            setShowWorkflow(true);
        }
    };

    const handleWorkflowComplete = (result: any) => {
        console.log('工作流完成:', result);
        setTimeout(() => {
            setShowWorkflow(false);
        }, 1000);
    };

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border p-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    工作流测试
                </h1>
            </header>

            <WorkflowProvider>
                <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
                    <div className="border border-border rounded-lg p-6 min-h-80 relative overflow-hidden bg-card shadow-sm">
                        {showWorkflow ? (
                            <AIWorkflow
                                trigger="工作流测试"
                                onComplete={handleWorkflowComplete}
                                displayMode="inline"
                            />
                        ) : (
                            <div className="text-center space-y-4 p-4">
                                <p className="text-gray-500">在输入框中输入&quot;工作流测试&quot;触发工作流</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        <textarea
                            className="w-full p-4 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
                            placeholder="输入问题..."
                            rows={3}
                            value={inputValue}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="flex justify-end mt-2">
                        <button
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                            onClick={handleButtonClick}
                        >
                            <Sparkles className="h-4 w-4" />
                            发送
                        </button>
                    </div>
                </main>
            </WorkflowProvider>
        </div>
    );
} 