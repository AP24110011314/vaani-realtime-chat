import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router'
import { conversationApi } from '../api/conversationApi'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'

export default function AppShell() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Conversations list query with 5s polling (Phase 3 requirement)
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(false),
    refetchInterval: 5000,
  })

  // Start direct chat mutation
  const startDirectMutation = useMutation({
    mutationFn: (targetUserId) => conversationApi.createDirect(targetUserId),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate(`/app/c/${newConv.id}`)
    },
  })

  const handleStartDirectChat = async (targetUser) => {
    return startDirectMutation.mutateAsync(targetUser.id)
  }

  const handleSelectConversation = (id) => {
    navigate(`/app/c/${id}`)
  }

  const handleBackToSidebar = () => {
    navigate('/app')
  }

  return (
    <div className="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - visible on desktop, or mobile when no conversation is selected */}
      <div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-slate-800 ${
          conversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={conversationId}
          onSelectConversation={handleSelectConversation}
          onStartDirectChat={handleStartDirectChat}
          isLoading={isLoading}
        />
      </div>

      {/* Main Chat Area - visible on desktop, or mobile when conversation is selected */}
      <div
        className={`flex-1 h-full min-w-0 ${
          !conversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatWindow
          conversationId={conversationId}
          onBack={handleBackToSidebar}
          currentUserId={user?.id}
        />
      </div>
    </div>
  )
}
