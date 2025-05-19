import React, { createContext, ReactNode, useContext, useReducer } from 'react';

// 定义工作流状态类型
interface WorkflowState {
    isActive: boolean;
    currentStep: number;
    result: any;
    error: string | null;
}

// 定义工作流动作类型
type WorkflowAction =
    | { type: 'START_WORKFLOW' }
    | { type: 'SET_STEP'; payload: number }
    | { type: 'SET_RESULT'; payload: any }
    | { type: 'SET_ERROR'; payload: string }
    | { type: 'RESET_WORKFLOW' };

// 初始状态
const initialState: WorkflowState = {
    isActive: false,
    currentStep: 0,
    result: null,
    error: null
};

// 创建上下文
const WorkflowContext = createContext<{
    state: WorkflowState;
    dispatch: React.Dispatch<WorkflowAction>;
} | undefined>(undefined);

// 工作流reducer
function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
    switch (action.type) {
        case 'START_WORKFLOW':
            return {
                ...state,
                isActive: true,
                currentStep: 0,
                error: null
            };
        case 'SET_STEP':
            return {
                ...state,
                currentStep: action.payload
            };
        case 'SET_RESULT':
            return {
                ...state,
                result: action.payload,
                isActive: false
            };
        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload,
                isActive: false
            };
        case 'RESET_WORKFLOW':
            return initialState;
        default:
            return state;
    }
}

// 工作流Provider组件
export function WorkflowProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(workflowReducer, initialState);

    return (
        <WorkflowContext.Provider value={{ state, dispatch }}>
            {children}
        </WorkflowContext.Provider>
    );
}

// 自定义Hook用于访问工作流上下文
export function useWorkflow() {
    const context = useContext(WorkflowContext);
    if (context === undefined) {
        throw new Error('useWorkflow must be used within a WorkflowProvider');
    }
    return context;
}

export type { WorkflowAction, WorkflowState };

