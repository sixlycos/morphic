"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import AIWorkflow from './AIWorkflow';

interface WorkflowContainerProps {
    children?: React.ReactNode;
    className?: string;
    displayMode?: 'fixed' | 'inline';
}

const WorkflowContainer: React.FC<WorkflowContainerProps> = ({
    children,
    className = "",
    displayMode = 'fixed'
}) => {
    const [workflowTrigger, setWorkflowTrigger] = useState<string>('');
    const [workflowResult, setWorkflowResult] = useState<any>(null);

    // 监听用户输入
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                const input = event.target.value;
                if (input.includes('工作流测试')) {
                    setWorkflowTrigger('工作流测试');
                }
            }
        };

        document.addEventListener('keyup', handleKeyPress);
        return () => {
            document.removeEventListener('keyup', handleKeyPress);
        };
    }, []);

    const handleWorkflowComplete = (result: any) => {
        setWorkflowResult(result);

        // 显示结果通知一段时间后自动消失
        setTimeout(() => {
            setWorkflowResult(null);
        }, 3000);

        setWorkflowTrigger(''); // 重置触发器
    };

    return (
        <div className={`relative ${className}`}>
            {children}
            <AIWorkflow
                trigger={workflowTrigger}
                onComplete={handleWorkflowComplete}
                displayMode={displayMode}
            />

            <AnimatePresence>
                {workflowResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="fixed top-4 right-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg shadow-lg border border-green-200 dark:border-green-800 max-w-md"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 bg-green-100 dark:bg-green-800 rounded-full p-1">
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-medium text-green-800 dark:text-green-300">
                                    {workflowResult.status === 'success' ? '工作流完成' : '工作流状态'}
                                </h3>
                                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                                    {workflowResult.message}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WorkflowContainer; 