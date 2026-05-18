"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Heart, MessageCircle, Send, X, Loader2, Plus, Trash2, Camera } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";

type Author = { id: string; username: string; avatar_url: string | null };
type Post = {
  id: string; content: string; images: string[]; category: string;
  likeCount: number; commentCount: number; isLiked: boolean; isMine: boolean;
  author: Author; createdAt: string;
};
type Comment = { id: string; content: string; isMine: boolean; author: Author; createdAt: string };

const CATEGORIES = [
  { value: "all", label: "전체", emoji: "🔥" },
  { value: "daily", label: "일상", emoji: "📸" },
  { value: "walk", label: "산책", emoji: "🐕" },
  { value: "health", label: "건강", emoji: "💊" },
  { value: "funny", label: "웃김", emoji: "😂" },
];

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(date).toLocaleDateString("ko-KR");
}

export default function SocialPage() {
  const { user } = usePet365Auth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 글쓰기
  const [showWrite, setShowWrite] = useState(false);
  const [writeContent, setWriteContent] = useState("");
  const [writeCategory, setWriteCategory] = useState("daily");
  const [writeImages, setWriteImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 상세/댓글
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  // 이미지 뷰어
  const [viewImage, setViewImage] = useState<string | null>(null);

  const fetchPosts = useCallback(async (cat: string, cursor?: string | null) => {
    if (!cursor) setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat, limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(`/api/pet365care/social/posts?${params}`);
      const d = await r.json();
      if (d.success) {
        if (cursor) {
          setPosts(prev => [...prev, ...d.data.posts]);
        } else {
          setPosts(d.data.posts);
        }
        setHasMore(d.data.hasMore);
        setNextCursor(d.data.nextCursor);
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      const timeoutId = window.setTimeout(() => {
        void fetchPosts(category);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [user, category, fetchPosts]);

  const handleLike = async (postId: string) => {
    const r = await fetch("/api/pet365care/social/like", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const d = await r.json();
    if (d.success) {
      const update = (p: Post) => p.id === postId ? { ...p, isLiked: d.data.liked, likeCount: p.likeCount + (d.data.liked ? 1 : -1) } : p;
      setPosts(prev => prev.map(update));
      if (detailPost?.id === postId) setDetailPost(prev => prev ? update(prev) : null);
    }
  };

  const handleUploadImages = async (files: FileList) => {
    if (writeImages.length + files.length > 4) { alert("최대 4장까지 가능합니다"); return; }
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    try {
      const r = await fetch("/api/pet365care/social/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) setWriteImages(prev => [...prev, ...d.data.urls]);
      else alert(d.error);
    } catch { alert("업로드 실패"); }
    setUploading(false);
  };

  const handlePost = async () => {
    if (!writeContent.trim()) return;
    setPosting(true);
    try {
      const r = await fetch("/api/pet365care/social/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: writeContent, images: writeImages, category: writeCategory }),
      });
      const d = await r.json();
      if (d.success) {
        setPosts(prev => [d.data, ...prev]);
        setShowWrite(false); setWriteContent(""); setWriteImages([]); setWriteCategory("daily");
      }
    } catch { /* */ }
    setPosting(false);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const r = await fetch(`/api/pet365care/social/posts?id=${postId}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDetailPost(null);
    }
  };

  const openDetail = async (post: Post) => {
    setDetailPost(post); setLoadingComments(true);
    const r = await fetch(`/api/pet365care/social/comments?postId=${post.id}`);
    const d = await r.json();
    if (d.success) setComments(d.data);
    setLoadingComments(false);
  };

  const handleComment = async () => {
    if (!commentText.trim() || !detailPost) return;
    setSendingComment(true);
    const r = await fetch("/api/pet365care/social/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: detailPost.id, content: commentText }),
    });
    const d = await r.json();
    if (d.success) {
      setComments(prev => [...prev, d.data]);
      setCommentText("");
      const update = (p: Post) => p.id === detailPost.id ? { ...p, commentCount: p.commentCount + 1 } : p;
      setPosts(prev => prev.map(update));
      setDetailPost(prev => prev ? update(prev) : null);
    }
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const r = await fetch(`/api/pet365care/social/comments?id=${commentId}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success && detailPost) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      const update = (p: Post) => p.id === detailPost.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p;
      setPosts(prev => prev.map(update));
      setDetailPost(prev => prev ? update(prev) : null);
    }
  };

  const getAvatar = (author: Author) => {
    if (author.avatar_url) return <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />;
    return <span className="text-sm font-bold text-white">{author.username[0]}</span>;
  };

  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between p-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            <span className="text-xl">🐱</span>
          </div>
          <h1 className="text-[#9c48ea] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>
      </header>

      <main className="px-5 flex flex-col gap-6">
        {/* Hero Card — 인기 모임 */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 px-1">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">우리 동네 인기 모임</h2>
            <p className="text-sm font-semibold text-[#9c48ea]">지금 가장 핫한 펫 모임을 확인해보세요 🔥</p>
          </div>
          <div className="h-52 rounded-[28px] overflow-hidden relative pet365-gradient-hero">
            <div className="absolute inset-0 flex items-center justify-center opacity-20 text-[100px]">🐕‍🦺🐕</div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-1.5">
              <div className="flex gap-2 mb-0.5">
                <span className="bg-[#62fae3] text-[#09070d] text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider">HOT</span>
                <span className="bg-white/30 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">망원 한강공원</span>
              </div>
              <h3 className="text-white text-lg font-bold leading-tight">토요일 아침 대형견 산책 모임</h3>
              <p className="text-white/80 text-xs font-medium">👥 멤버 12명 참여 중</p>
            </div>
          </div>
        </section>

        {/* Activity Categories */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-900 px-1">어떤 활동을 찾으시나요?</h2>
          <div className="pet365-soft-panel rounded-[24px] p-4 flex items-center justify-between cursor-pointer transition-colors relative overflow-hidden h-24">
            <div className="flex flex-col z-10 pl-1">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">📸 일상 공유</h3>
              <p className="text-xs text-gray-600 font-medium">우리 아이의 귀여운 순간을<br/>자랑해보세요</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#9c48ea] mr-1 z-10">
              <Camera size={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="pet365-card-tight p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-28">
              <div className="w-10 h-10 bg-[#FFF3CD] rounded-full flex items-center justify-center text-lg mb-2">📍</div>
              <h3 className="text-sm font-bold text-gray-900">지역 모임</h3>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">동네 친구 만들기</p>
            </div>
            <div className="pet365-card-tight p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-28">
              <div className="w-10 h-10 bg-[#F2C99D]/40 rounded-full flex items-center justify-center text-lg mb-2">🐾</div>
              <h3 className="text-sm font-bold text-gray-900">산책 메이트</h3>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">함께 걷는 즐거움</p>
            </div>
          </div>
        </section>

        {/* 커뮤니티 피드 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-900 px-1">📝 커뮤니티</h2>
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => { setCategory(c.value); setNextCursor(null); }}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                  category === c.value
                    ? "bg-[#9c48ea] text-white shadow-md shadow-[#9c48ea]/25"
                    : "bg-white text-gray-600"
                }`}
              >
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Posts */}
        <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#9c48ea]" size={28} /></div>
        ) : posts.length === 0 ? (
          <div className="pet365-card p-8 flex flex-col items-center text-center">
            <span className="text-5xl mb-3">📝</span>
            <p className="text-sm text-gray-500 font-medium">아직 게시물이 없어요.<br/>첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <article key={post.id} className="pet365-card overflow-hidden">
                {/* Author */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9c48ea] to-[#62fae3] flex items-center justify-center overflow-hidden shadow-sm">
                    {getAvatar(post.author)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[13px] text-gray-900">{post.author.username}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{timeAgo(post.createdAt)} · {CATEGORIES.find(c => c.value === post.category)?.label || post.category}</p>
                  </div>
                  {post.isMine && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="px-4 pb-3 cursor-pointer" onClick={() => openDetail(post)}>
                  <p className="text-[14px] text-gray-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Images */}
                {post.images.length > 0 && (
                  <div className={`grid gap-1 px-1 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {post.images.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setViewImage(img)}
                        className={`relative cursor-pointer overflow-hidden ${
                          post.images.length === 1 ? "h-56 rounded-2xl mx-3" :
                          post.images.length === 3 && i === 0 ? "row-span-2 h-full rounded-l-2xl" : "h-28 last:rounded-br-2xl first:rounded-tl-2xl"
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        {i === 3 && post.images.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">+{post.images.length - 4}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-6 px-4 py-3">
                  <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 group">
                    <Heart
                      size={18}
                      className={`transition-all group-active:scale-125 ${post.isLiked ? "fill-red-500 text-red-500" : "text-gray-400"}`}
                    />
                    <span className={`text-xs font-bold ${post.isLiked ? "text-red-500" : "text-gray-400"}`}>{post.likeCount || ""}</span>
                  </button>
                  <button onClick={() => openDetail(post)} className="flex items-center gap-1.5 text-gray-400">
                    <MessageCircle size={18} />
                    <span className="text-xs font-bold">{post.commentCount || ""}</span>
                  </button>
                </div>
              </article>
            ))}

            {hasMore && (
              <button
                onClick={() => fetchPosts(category, nextCursor)}
                className="py-3 text-sm font-bold text-[#9c48ea] text-center"
              >
                더 보기
              </button>
            )}
          </>
        )}
        </div>
      </main>

      {/* FAB — 글쓰기 */}
      <button
        onClick={() => setShowWrite(true)}
        className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-br from-[#9c48ea] to-[#62fae3] text-[#09070d] rounded-full shadow-lg shadow-[#9c48ea]/30 flex items-center justify-center active:scale-90 transition-transform z-50"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* 글쓰기 모달 */}
      {showWrite && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWrite(false)} />
          <div className="bg-white rounded-t-[36px] px-6 py-6 relative z-10 shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-gray-900">새 글 작성</h2>
              <button onClick={() => setShowWrite(false)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
              {CATEGORIES.filter(c => c.value !== "all").map(c => (
                <button
                  key={c.value}
                  onClick={() => setWriteCategory(c.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    writeCategory === c.value ? "bg-[#9c48ea] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            <textarea
              value={writeContent}
              onChange={e => setWriteContent(e.target.value)}
              placeholder="반려동물과의 일상을 공유해보세요 ✨"
              className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-[14px] text-gray-800 font-medium outline-none resize-none min-h-[120px] focus:ring-2 focus:ring-[#9c48ea]/20 border border-transparent focus:border-[#9c48ea]/20"
              autoFocus
            />

            {/* Image preview */}
            {writeImages.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                {writeImages.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setWriteImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || writeImages.length >= 4}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  사진 {writeImages.length}/4
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleUploadImages(e.target.files)} />
              </div>

              <button
                onClick={handlePost}
                disabled={posting || !writeContent.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-[#09070d] rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
              >
                {posting ? <Loader2 size={16} className="animate-spin" /> : "게시하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세/댓글 모달 */}
      {detailPost && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailPost(null)} />
          <div className="bg-white rounded-t-[36px] px-5 pt-5 pb-3 relative z-10 shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9c48ea] to-[#62fae3] flex items-center justify-center overflow-hidden">
                  {getAvatar(detailPost.author)}
                </div>
                <div>
                  <p className="font-bold text-[13px] text-gray-900">{detailPost.author.username}</p>
                  <p className="text-[11px] text-gray-400">{timeAgo(detailPost.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setDetailPost(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar mb-3">
              <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">{detailPost.content}</p>

              {detailPost.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mb-4 hide-scrollbar">
                  {detailPost.images.map((img, i) => (
                    <img key={i} src={img} alt="" onClick={() => setViewImage(img)} className="h-40 rounded-xl object-cover cursor-pointer flex-shrink-0" />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
                <button onClick={() => handleLike(detailPost.id)} className="flex items-center gap-1.5">
                  <Heart size={18} className={detailPost.isLiked ? "fill-red-500 text-red-500" : "text-gray-400"} />
                  <span className={`text-xs font-bold ${detailPost.isLiked ? "text-red-500" : "text-gray-400"}`}>{detailPost.likeCount}</span>
                </button>
                <span className="text-xs font-bold text-gray-400">💬 {detailPost.commentCount}</span>
              </div>

              {/* Comments */}
              {loadingComments ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">첫 번째 댓글을 남겨보세요!</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                        {getAvatar(c.author)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{c.author.username}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                          {c.isMine && (
                            <button onClick={() => handleDeleteComment(c.id)} className="text-gray-300 hover:text-red-400 ml-auto">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-700 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment input */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="댓글을 입력하세요..."
                className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-sm text-gray-800 outline-none font-medium"
              />
              <button
                onClick={handleComment}
                disabled={sendingComment || !commentText.trim()}
                className="w-9 h-9 bg-[#9c48ea] rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
              >
                {sendingComment ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 뷰어 */}
      {viewImage && (
        <div className="fixed inset-0 z-[400] bg-black flex items-center justify-center" onClick={() => setViewImage(null)}>
          <img src={viewImage} alt="" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center" onClick={() => setViewImage(null)}>
            <X size={20} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
