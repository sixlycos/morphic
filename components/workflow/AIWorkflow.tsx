import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';

interface AIWorkflowProps {
    trigger?: string;
    onComplete?: (result: any) => void;
}

const AIWorkflow: React.FC<AIWorkflowProps> = ({ trigger, onComplete }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [thinking, setThinking] = useState(false);

    const workflowSteps = [
        {
            id: 'input',
            title: '输入分析',
            description: '正在分析您的需求...',
            icon: '🔍'
        },
        {
            id: 'processing',
            title: '智能处理',
            description: '使用AI模型进行推理...',
            icon: '🧠'
        },
        {
            id: 'output',
            title: '生成结果',
            description: '正在整合分析结果...',
            icon: '✨'
        }
    ];

    useEffect(() => {
        if (trigger === '工作流测试') {
            setIsVisible(true);
            simulateWorkflow();
        }
    }, [trigger]);

    const simulateWorkflow = async () => {
        setIsVisible(true);

        // 模拟工作流程
        for (let i = 0; i < workflowSteps.length; i++) {
            setCurrentStep(i);
            setThinking(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            setThinking(false);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 完成后的回调
        if (onComplete) {
            onComplete({
                status: 'success',
                message: '工作流程已完成'
            });
        }

        // 重置状态
        setTimeout(() => {
            setIsVisible(false);
            setCurrentStep(0);
        }, 1000);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96"
                >
                    <div className="space-y-4">
                        {workflowSteps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{
                                    x: 0,
                                    opacity: currentStep >= index ? 1 : 0.5
                                }}
                                className={`flex items-center space-x-4 ${currentStep === index ? 'text-blue-500' : 'text-gray-500'
                                    }`}
                            >
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                                    <span className="text-xl">{step.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-medium">{step.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {step.description}
                                    </p>
                                </div>
                                {currentStep === index && thinking && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                                    />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AIWorkflow; 