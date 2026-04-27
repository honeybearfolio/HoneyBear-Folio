import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFormatNumber } from "../../utils/format";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { GripVertical, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Account {
  id: string | number;
  name: string;
  balance: number;
  currency?: string;
}

interface AccountListProps {
  accounts: Account[];
  selectedId?: string | number;
  onSelectAccount: (id: string | number) => void;
  marketValues?: Record<string, number>;
  Icon: React.ComponentType<{ className?: string }>;
  onReorder?: (accounts: Account[]) => void;
  isDraggable?: boolean;
  onRenameAccount?: (id: string | number, newName: string) => void;
  onDeleteAccount?: (id: string | number) => void;
}

export default function AccountList({
  accounts,
  selectedId,
  onSelectAccount,
  marketValues,
  Icon,
  onReorder,
  isDraggable,
  onRenameAccount,
  onDeleteAccount,
}: AccountListProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const draggingIdRef = useRef<string | number | null>(null);
  const lastReorder = useRef(0);
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        menuOpenId &&
        !target?.closest(".account-list-menu-container") &&
        !target?.closest(".account-list-menu-portal")
      ) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  useEffect(() => {
    function handleScrollOrResize() {
      if (menuOpenId) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (renamingId) {
      setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [renamingId]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, accountId: string | number) => {
      // Store in both state (for UI) and ref (for reliable access during drag)
      setDraggingId(accountId);
      draggingIdRef.current = accountId;

      // Set data transfer - required for drag to work
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(accountId));
      e.dataTransfer.setData("application/x-account-id", String(accountId));
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Setting dropEffect is critical for Windows to show correct cursor
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLElement>, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";

      if (!onReorder) return;

      // Use ref for reliable access on Windows
      const currentDraggingId = draggingIdRef.current;
      if (!currentDraggingId) return;

      // Throttle reorder operations using event timestamp (avoids impure Date.now call during render)
      const now = e.timeStamp;
      if (now - lastReorder.current < 50) return;

      const dragIndex = accounts.findIndex((a) => a.id === currentDraggingId);
      if (dragIndex === -1 || dragIndex === targetIndex) return;

      lastReorder.current = now;

      const newItems = [...accounts];
      const item = newItems[dragIndex];
      newItems.splice(dragIndex, 1);
      newItems.splice(targetIndex, 0, item);
      onReorder(newItems);
    },
    [accounts, onReorder],
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    draggingIdRef.current = null;
  }, []);

  return (
    <div
      className="space-y-1"
      role="listbox"
      aria-label={t("account.list")}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const currentIndex = accounts.findIndex((a) => a.id === selectedId);
          const nextIndex =
            e.key === "ArrowDown"
              ? Math.min(currentIndex + 1, accounts.length - 1)
              : Math.max(currentIndex - 1, 0);
          if (nextIndex >= 0 && nextIndex < accounts.length) {
            onSelectAccount(accounts[nextIndex].id);
          }
        }
      }}
    >
      {accounts.map((account, index) => {
        const cashBalance = Number(account.balance);
        const marketValue =
          marketValues && marketValues[account.id] !== undefined
            ? Number(marketValues[account.id])
            : 0;
        const totalValue = cashBalance + marketValue;
        const hasInvestments = Math.abs(marketValue) > 0.01;

        const formattedTotal = formatNumber(totalValue, {
          style: "currency",
          currency: account.currency || undefined,
        });

        const finalFormattedTotal =
          formattedTotal === "NaN" ? "" : formattedTotal;

        const isDragging = draggingId === account.id;

        return (
          <div
            key={account.id}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onContextMenu={
              onRenameAccount || onDeleteAccount
                ? (e) => {
                    e.preventDefault();
                    setMenuCoords({ x: e.clientX, y: e.clientY });
                    setMenuOpenId(account.id);
                  }
                : undefined
            }
            className={`block w-full transition-all duration-200 ${isDragging ? "opacity-50" : ""} account-list-menu-container`}
            data-index={index}
          >
            {renamingId === account.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameValue.trim()) {
                    onRenameAccount?.(account.id, renameValue.trim());
                  }
                  setRenamingId(null);
                }}
                className={`sidebar-nav-item justify-between w-full ${
                  selectedId === account.id
                    ? "sidebar-nav-item-active"
                    : "sidebar-nav-item-inactive"
                }`}
              >
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) {
                      onRenameAccount?.(account.id, renameValue.trim());
                    }
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  aria-label={t("account.action.rename")}
                  className="flex-1 min-w-0 bg-transparent border-b border-brand-400 outline-none text-sm font-medium"
                />
              </form>
            ) : (
              <button
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, account.id)}
                onClick={() => onSelectAccount(account.id)}
                role="option"
                aria-selected={selectedId === account.id}
                className={`sidebar-nav-item justify-between group w-full ${isDraggable ? "cursor-move" : ""} ${
                  selectedId === account.id
                    ? "sidebar-nav-item-active"
                    : "sidebar-nav-item-inactive"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isDraggable && (
                    <GripVertical
                      className="w-4 h-4 text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {!isDraggable && (
                    <Icon
                      className={`sidebar-nav-icon shrink-0 ${
                        selectedId === account.id
                          ? "sidebar-nav-icon-active"
                          : "sidebar-nav-icon-inactive"
                      }`}
                    />
                  )}
                  <span className="font-medium truncate">{account.name}</span>
                </div>
                <div
                  className={`flex flex-col items-end shrink-0 ml-2 ${
                    selectedId === account.id
                      ? "text-brand-100"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                >
                  <span
                    className={`font-medium ${
                      finalFormattedTotal && finalFormattedTotal.length > 14
                        ? "text-xs"
                        : "text-sm"
                    }`}
                  >
                    <MaskedNumber
                      value={totalValue}
                      options={{
                        style: "currency",
                        currency: account.currency || undefined,
                      }}
                    />
                  </span>
                  {hasInvestments && (
                    <span className="text-[10px] opacity-80">
                      <MaskedNumber
                        value={cashBalance}
                        options={{
                          style: "currency",
                          currency: account.currency || undefined,
                        }}
                      />
                    </span>
                  )}
                </div>
              </button>
            )}

            {menuOpenId === account.id &&
              menuCoords &&
              createPortal(
                <div
                  className="fixed z-50 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 py-1.5 animate-fade-in account-list-menu-portal"
                  role="menu"
                  aria-label={t("account.context_menu")}
                  style={{
                    top: `${menuCoords.y}px`,
                    left: `${Math.min(menuCoords.x, window.innerWidth - 176 - 8)}px`,
                  }}
                >
                  {onRenameAccount && (
                    <button
                      onClick={() => {
                        setRenameValue(account.name);
                        setRenamingId(account.id);
                        setMenuOpenId(null);
                        setMenuCoords(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                    >
                      <Edit className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      {t("account.action.rename")}
                    </button>
                  )}
                  {onDeleteAccount && (
                    <button
                      onClick={() => {
                        onDeleteAccount(account.id);
                        setMenuOpenId(null);
                        setMenuCoords(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-3 font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("account.action.delete")}
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </div>
        );
      })}
    </div>
  );
}
