import { message } from '@/components/bs-ui/toast/use-toast';
import { generateUUID } from '@/components/bs-ui/utils'
import { MessageDB, getChatHistory } from '@/controllers/API'
import { ChatMessageType } from '@/types/chat'
import { cloneDeep } from 'lodash'
import { create } from 'zustand'

/**
 * 会话消息管理
 */

type State = {
    running: boolean,
    /**
     * 会话 ID
     * 变更会触发 ws建立，解锁滚动
     */
    chatId: string,
    messages: ChatMessageType[]
}

type Actions = {

}


const handleHistoryMsg = (data) => {
    return data.map(item => {
        // let count = 0
        let { message, files, is_bot, intermediate_steps, ...other } = item
        try {
            message = message && message[0] === '{' ? JSON.parse(message.replace(/([\t\n"])/g, '\\$1').replace(/'/g, '"')) : message || ''
        } catch (e) {
            // 未考虑的情况暂不处理
        }
        return {
            ...other,
            chatKey: typeof message === 'string' ? undefined : Object.keys(message)[0],
            end: true,
            files: files ? JSON.parse(files) : [],
            isSend: !is_bot,
            message,
            thought: intermediate_steps,
            noAccess: true
        }
    })
}

export const useMessageStore = create<State & Actions>((set, get) => ({
    running: false,
    chatId: '',
    messages: [],
        async loadHistoryMsg(flowid, chatId) {
            const res = await getChatHistory(flowid, chatId, 30, 0)
            const msgs = handleHistoryMsg(res)
            set({ messages: msgs.reverse() })
        },
        async loadMoreHistoryMsg(flowid) {
            const chatId = get().chatId
            const prevMsgs = get().messages
            const res = await getChatHistory(flowid, chatId, 10, prevMsgs[0]?.id || 0)
            const msgs = handleHistoryMsg(res)
            set({ messages: [...msgs.reverse(), ...prevMsgs] })
        },
        destory() {
            set({ chatId: '', messages: [] })
        },
        createSendMsg(inputs, inputKey) {
            console.log('change createSendMsg', inputs, inputKey);
            
            set((state) => ({ messages: 
                [...state.messages, {
                    isSend: true,
                    message: inputs,
                    chatKey: inputKey,
                    thought: '',
                    category: '',
                    files: [],
                    end: false,
                    user_name: ""
                }]
             }))
        },
        createWsMsg(data) {
            console.log('change createWsMsg');
            set((state) => {
                let newChat = cloneDeep(state.messages);
                newChat.push({
                    isSend: false,
                    message: '',
                    chatKey: '',
                    thought: data.intermediate_steps || '',
                    category: data.category || '',
                    files: [],
                    end: false,
                    user_name: ''
                })
                return { messages: newChat}
            })
        },
        updateCurrentMessage(wsdata) {
            console.log('change updateCurrentMessage');
            const messages =  get().messages
            const currentMessage = messages[messages.length - 1];

            const newCurrentMessage = {
                ...currentMessage,
                ...wsdata,
                id: wsdata.messageId,
                message: currentMessage.message + wsdata.message,
                thought: currentMessage.thought + (wsdata.thought ? `${wsdata.thought}\n` : ''),
                files: wsdata.files || null,
                category: wsdata.category || '',
                source: wsdata.source
            }

            messages[messages.length - 1] = newCurrentMessage
            // start - end 之间没有内容删除load
            if (newCurrentMessage.end && !(newCurrentMessage.files.length || newCurrentMessage.thought || newCurrentMessage.message)) {
                messages.pop()
            }
            // 无 messageid 删除
            // if (newCurrentMessage.end && !newCurrentMessage.id) {
            //     messages.pop()
            // }
            // 删除重复消息
            const prevMessage = messages[messages.length - 2];
            if (prevMessage && prevMessage.message === newCurrentMessage.message) {
                const removedMsg = messages.pop()
                prevMessage.id = removedMsg.id
            }
            set((state) => ({ messages: [...messages] }))
        },
        changeChatId(chatId) {
            set((state) => ({ chatId }))
        },
        insetSeparator(text) {
            const msgItem = {
                id: Math.random() * 1000000,
                isSend: false,
                message: text,
                chatKey: '',
                thought: '',
                category: 'divider',
                files: [],
                end: true,
                user_name: ''
            }

            set((state) => ({
                messages: [...state.messages, msgItem]
            }))
        }
    })
)