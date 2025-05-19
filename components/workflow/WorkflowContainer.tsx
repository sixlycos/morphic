import React, { useEffect, useState } from 'react';
import AIWorkflow from './AIWorkflow';

interface WorkflowContainerProps {
    children?: React.ReactNode;
}

const WorkflowContainer: React.FC<WorkflowContainerProps> = ({ children }) => {
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
        setWorkflowTrigger(''); // 重置触发器
    };

    return (
        <div className="relative">
            {children}
            <AIWorkflow
                trigger={workflowTrigger}
                onComplete={handleWorkflowComplete}
            />
            {workflowResult && (
                <div className="fixed top-4 right-4 bg-green-100 dark:bg-green-900 p-4 rounded-lg shadow-lg">
                    <p className="text-green-800 dark:text-green-200">
                        {workflowResult.message}
                    </p>
                </div>
            )}
        </div>
    );
};

export default WorkflowContainer; 