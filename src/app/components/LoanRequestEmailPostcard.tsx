import { useMemo, useState } from "react";
import type { LenderPipelineRecord, UploadedDocumentInput } from "../services/workflowApi";
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Home,
  Image,
  Mail,
  MapPin,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

type DocumentItem = {
  id: string;
  name: string;
};

type PhotoItem = {
  id: string;
  name: string;
  src: string;
};

const photos: PhotoItem[] = [
  { id: "photo-1", name: "Exterior View", src: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=80" },
  { id: "photo-2", name: "Living Room", src: "https://images.unsplash.com/photo-1616594039964-c55c1dc15f52?auto=format&fit=crop&w=1400&q=80" },
  { id: "photo-3", name: "Kitchen", src: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=1400&q=80" },
  { id: "photo-4", name: "Bedroom", src: "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1400&q=80" },
];

type LoanRequestEmailPostcardProps = {
  record?: LenderPipelineRecord | null;
  showDashboardLink?: boolean;
  dashboardHref?: string;
  title?: string;
  subtitle?: string;
  mode?: "standalone" | "in-app";
  showHero?: boolean;
  showAccentStripes?: boolean;
  onApprove?: () => void;
  onLeaveComment?: () => void;
  onMessageBorrower?: () => void;
  onDenyWithNotes?: () => void;
  actionLoading?: {
    approve?: boolean;
    comment?: boolean;
    message?: boolean;
    deny?: boolean;
  };
  disableActions?: boolean;
};

function formatCurrency(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(String(value || "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return "N/A";
  return numeric.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function readDocumentName(input: UploadedDocumentInput, fallback: string) {
  if (typeof input === "string" && input.trim()) return input.trim();
  if (input && typeof input === "object" && typeof input.name === "string" && input.name.trim()) {
    return input.name.trim();
  }
  return fallback;
}

function readPhotoSource(input: UploadedDocumentInput, fallback: string) {
  if (input && typeof input === "object" && typeof input.dataUrl === "string" && input.dataUrl.trim()) {
    return input.dataUrl.trim();
  }
  return fallback;
}

export function LoanRequestEmailPostcard({
  record,
  showDashboardLink = true,
  dashboardHref = "/loan-application-summary",
  title = "New Loan Request",
  subtitle = "A new request is ready for lender review.",
  mode = "standalone",
  showHero = true,
  showAccentStripes = true,
  onApprove,
  onLeaveComment,
  onMessageBorrower,
  onDenyWithNotes,
  actionLoading,
  disableActions = false,
}: LoanRequestEmailPostcardProps) {
  const isInApp = mode === "in-app";
  const typography = isInApp
    ? {
        loanIdValue: "text-lg",
        avatarText: "text-lg",
        fieldValue: "text-base",
        amountTitle: "text-xl",
        amountLabel: "text-base",
        amountValue: "text-xl",
        arvValue: "text-xl",
        sectionTitle: "text-xl",
        sectionValue: "text-lg",
        documentName: "text-base",
        footerLink: "text-base",
      }
    : {
        loanIdValue: "text-xl",
        avatarText: "text-xl",
        fieldValue: "text-2xl",
        amountTitle: "text-4xl",
        amountLabel: "text-2xl",
        amountValue: "text-4xl",
        arvValue: "text-5xl",
        sectionTitle: "text-4xl",
        sectionValue: "text-4xl",
        documentName: "text-2xl",
        footerLink: "text-2xl",
      };
  const purchase = record?.purchaseDetails || null;
  const loanId = record?.loanId || "LA-2026-1526";
  const borrowerName = record?.borrower || "Mary Ann";
  const borrowerEmail = record?.borrowerEmail || "leahmaebowden@gmail.com";
  const propertyAddress = record?.property || "Navy-Marine Corps Way, North Versailles, Pennsylvania 15137";
  const loanType = record?.type || "Fix & Flip Loan (Rehab Loan)";
  const loanAmount = formatCurrency(record?.amount ?? 100000);
  const purchasePrice = purchase?.purchasePrice || "$50,000.00";
  const rehabBudget = purchase?.rehabBudget || "$50,000.00";
  const arv = purchase?.arv || "$250,000.00";
  const exitStrategy = purchase?.exitStrategy || "Refinance to DSCR (stabilized rental)";
  const targetClosingDate = purchase?.targetClosingDate || "2026-02-23";
  const borrowerInitials = borrowerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "MA";

  const dynamicDocuments: DocumentItem[] = [
    {
      id: "purchase-contract",
      name:
        Array.isArray(purchase?.purchaseContractFiles) && purchase.purchaseContractFiles.length > 0
          ? readDocumentName(purchase.purchaseContractFiles[0], "Purchase Contract")
          : "Purchase Contract",
    },
    {
      id: "rehab-scope",
      name:
        Array.isArray(purchase?.scopeOfWorkFiles) && purchase.scopeOfWorkFiles.length > 0
          ? readDocumentName(purchase.scopeOfWorkFiles[0], "Itemized Rehab Scope")
          : "Itemized Rehab Scope",
    },
    {
      id: "comps",
      name:
        Array.isArray(purchase?.compsFiles) && purchase.compsFiles.length > 0
          ? readDocumentName(purchase.compsFiles[0], "COMPS")
          : "COMPS",
    },
  ];

  const dynamicPhotos: PhotoItem[] =
    Array.isArray(purchase?.propertyPhotos) && purchase.propertyPhotos.length > 0
      ? purchase.propertyPhotos.slice(0, 4).map((item, index) => ({
          id: `photo-${index + 1}`,
          name: readDocumentName(item, `Photo ${index + 1}`),
          src: readPhotoSource(item, photos[index % photos.length].src),
        }))
      : photos;

  const dashboardHrefWithLoanId = useMemo(() => {
    if (!showDashboardLink) return "";
    if (!record?.loanId) return dashboardHref;
    if (/[?&]loanId=/.test(dashboardHref)) return dashboardHref;
    const separator = dashboardHref.includes("?") ? "&" : "?";
    return `${dashboardHref}${separator}loanId=${encodeURIComponent(record.loanId)}`;
  }, [dashboardHref, record?.loanId, showDashboardLink]);

  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const closeDocumentPreview = () => {
    setSelectedDocument(null);
  };

  const closePhotoGallery = () => {
    setIsGalleryOpen(false);
  };

  const activePhoto = useMemo(() => dynamicPhotos[activePhotoIndex] || dynamicPhotos[0], [dynamicPhotos, activePhotoIndex]);

  const openPhotoGallery = (index: number) => {
    setActivePhotoIndex(index);
    setIsGalleryOpen(true);
  };

  const showNextPhoto = () => {
    setActivePhotoIndex((current) => (current + 1) % dynamicPhotos.length);
  };

  const showPreviousPhoto = () => {
    setActivePhotoIndex((current) => (current - 1 + dynamicPhotos.length) % dynamicPhotos.length);
  };

  const handleDocumentDownload = (doc: DocumentItem) => {
    const blob = new Blob([`Document placeholder for: ${doc.name}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.name.toLowerCase().replace(/\s+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={mode === "standalone" ? "min-h-screen bg-slate-200 p-4 md:p-6" : "bg-transparent"}>
      <div className={`mx-auto w-full ${isInApp ? "max-w-[1240px]" : "max-w-[1400px]"}`}>
        <div className="relative">
          <div
            className={`absolute inset-0 translate-x-2 translate-y-2 rounded-[28px] blur-md ${
              mode === "standalone" ? "bg-slate-900/30" : "bg-slate-900/15"
            }`}
          />
          <div className="relative overflow-hidden rounded-[28px] border-[8px] border-white bg-slate-100 shadow-2xl">
            {showAccentStripes ? <div className="h-[2px] bg-gradient-to-r from-red-500 via-blue-600 to-purple-600" /> : null}

            {showHero ? (
              <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 pb-12 md:p-12 md:pb-14">
                <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/10" />
                <div className="absolute -right-10 -top-12 h-60 w-60 rounded-full bg-white/10" />

                <div className="pointer-events-none absolute right-6 top-6 z-30 h-20 w-20 rotate-12 rounded-xl border-[4px] border-white bg-gradient-to-br from-red-500 to-red-700 shadow-lg">
                  <div className="absolute inset-[5px] rounded-md border border-dashed border-red-200/50" />
                  <div className="flex h-full w-full flex-col items-center justify-center leading-none text-white">
                    <span className="text-[11px] font-extrabold italic tracking-[0.08em]">URGENT</span>
                    <span className="mt-2 text-[9px] font-semibold italic tracking-[0.12em]">REVIEW</span>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-4">
                    <Mail className="h-8 w-8 text-white" />
                    <h1 className={`${isInApp ? "text-3xl md:text-4xl" : "text-5xl md:text-6xl"} font-extrabold text-white`}>{title}</h1>
                  </div>
                  <p className={`${isInApp ? "text-lg md:text-xl" : "text-2xl md:text-3xl"} text-blue-100`}>{subtitle}</p>
                </div>
              </div>
            ) : null}

            <div className={`${showHero ? "-mt-2" : "mt-6"} mb-8 px-6 md:px-12`}>
              <p className="text-sm font-semibold text-black">Loan ID</p>
              <p className={`${typography.loanIdValue} font-extrabold text-black`}>{loanId}</p>
            </div>

            <div className="space-y-8 px-6 pb-8 md:px-12 md:pb-10">
              <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1.03fr_1fr]">
                <div className="space-y-7">
                  <div className="flex gap-4">
                    <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 ${typography.avatarText} font-bold text-blue-600`}>
                      {borrowerInitials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Borrower</p>
                      <p className={`${typography.fieldValue} font-semibold text-slate-900`}>{borrowerName}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 rounded-full bg-blue-100 p-2 text-blue-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Borrower Email</p>
                      <a
                        href={`mailto:${borrowerEmail}`}
                        className={`${typography.fieldValue} font-semibold text-blue-600 hover:text-blue-700 hover:underline`}
                      >
                        {borrowerEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 rounded-full bg-green-100 p-2 text-green-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Property</p>
                      <p className={`${typography.fieldValue} font-semibold leading-snug text-slate-900`}>{propertyAddress}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 rounded-full bg-purple-100 p-2 text-purple-600">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Loan Type</p>
                      <p className={`${typography.fieldValue} font-semibold text-slate-900`}>{loanType}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-full bg-slate-200 p-2 text-slate-700">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <h3 className={`${typography.amountTitle} font-bold text-slate-700`}>Loan Request Amount</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-end justify-between gap-3">
                      <p className={`${typography.amountLabel} font-medium text-slate-600`}>Loan Amount</p>
                      <p className={`${typography.amountValue} font-semibold text-slate-900`}>{loanAmount}</p>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <p className={`${typography.amountLabel} font-medium text-slate-600`}>Purchase Price</p>
                      <p className={`${typography.amountValue} font-semibold text-slate-900`}>{formatCurrency(purchasePrice)}</p>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <p className={`${typography.amountLabel} font-medium text-slate-600`}>Rehab Budget</p>
                      <p className={`${typography.amountValue} font-semibold text-slate-900`}>{formatCurrency(rehabBudget)}</p>
                    </div>
                  </div>
                  <div className="mt-6 border-t-2 border-slate-300 pt-6">
                    <div className="flex items-end justify-between gap-3">
                      <p className={`${typography.amountLabel} font-medium text-slate-600`}>ARV</p>
                      <p className={`${typography.arvValue} font-semibold text-slate-900`}>{formatCurrency(arv)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl p-4">
                  <div className="mb-2 flex items-center gap-2 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                    <p className={`${typography.amountLabel} font-semibold text-slate-500`}>Exit Strategy</p>
                  </div>
                  <p className={`${typography.sectionValue} font-semibold text-slate-900`}>{exitStrategy}</p>
                </div>
                <div className="rounded-xl p-4">
                  <div className="mb-2 flex items-center gap-2 text-red-600">
                    <Calendar className="h-5 w-5" />
                    <p className={`${typography.amountLabel} font-semibold text-slate-500`}>Target Closing</p>
                  </div>
                  <p className={`${typography.sectionValue} font-semibold text-slate-900`}>{targetClosingDate}</p>
                </div>
              </div>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className={`${typography.sectionTitle} font-bold text-slate-700`}>Uploaded Documents</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {dynamicDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className="group h-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-center text-slate-900 transition-colors hover:bg-slate-100"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <div className="w-full">
                        <div className="mb-4 inline-flex rounded-2xl bg-red-100 p-4 text-red-600 transition-colors group-hover:bg-red-200">
                          <FileText className="h-7 w-7" />
                        </div>
                        <p className={`${typography.documentName} font-semibold text-slate-700`}>{doc.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Image className="h-5 w-5 text-slate-700" />
                  <h3 className={`${typography.sectionTitle} font-bold text-slate-700`}>Property Photos</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {dynamicPhotos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => openPhotoGallery(index)}
                      className="group overflow-hidden rounded-2xl border-2 border-slate-200 bg-white transition-all hover:scale-105 hover:border-blue-400"
                    >
                      <div className="aspect-[4/3]">
                        <img src={photo.src} alt={photo.name} className="h-full w-full object-cover" />
                      </div>
                      <p className="truncate px-3 py-2 text-left text-sm font-semibold text-slate-700">{photo.name}</p>
                    </button>
                  ))}
                </div>
              </section>

              <div className="border-t-2 border-dashed border-slate-300" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  size="lg"
                  className="h-14 w-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                  onClick={onApprove}
                  disabled={disableActions || Boolean(actionLoading?.approve) || !onApprove}
                >
                  {actionLoading?.approve ? "Approving..." : "Approve"}
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-full bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                  onClick={onLeaveComment}
                  disabled={disableActions || Boolean(actionLoading?.comment) || !onLeaveComment}
                >
                  {actionLoading?.comment ? "Saving..." : "Leave Comment"}
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={onMessageBorrower}
                  disabled={disableActions || Boolean(actionLoading?.message) || !onMessageBorrower}
                >
                  {actionLoading?.message ? "Sending..." : "Message Borrower"}
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={onDenyWithNotes}
                  disabled={disableActions || Boolean(actionLoading?.deny) || !onDenyWithNotes}
                >
                  {actionLoading?.deny ? "Saving..." : "Deny with Notes"}
                </Button>
              </div>

              {showDashboardLink ? (
                <div className="pb-2 text-center">
                  <a
                    href={dashboardHrefWithLoanId}
                    className={`inline-flex items-center gap-2 ${typography.footerLink} font-semibold text-blue-600 underline transition-colors hover:text-blue-700`}
                  >
                    Open lender dashboard
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </div>
              ) : null}
            </div>

            {showAccentStripes ? <div className="h-[2px] bg-gradient-to-r from-red-500 via-blue-600 to-purple-600" /> : null}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && closeDocumentPreview()}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden p-0">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b-2 border-slate-200 p-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">Document Preview</p>
                <h4 className="truncate text-xl font-bold text-slate-900">{selectedDocument?.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                {selectedDocument ? (
                  <Button
                    variant="outline"
                    className="border-2 border-slate-300"
                    onClick={() => handleDocumentDownload(selectedDocument)}
                  >
                    Download
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={closeDocumentPreview}
                  className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                  aria-label="Close document preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center">
              <div className="mb-4 rounded-full bg-red-100 p-4 text-red-600">
                <FileText className="h-10 w-10" />
              </div>
              <p className="mb-2 text-lg font-semibold text-slate-900">Preview Placeholder</p>
              <p className="max-w-2xl text-sm text-slate-600">
                In a production environment, this would display the PDF using a viewer library.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent
          overlayClassName="bg-black/80"
          className="h-[90vh] max-w-6xl border-2 border-slate-700 bg-black p-4 text-white md:p-6"
        >
          <button
            type="button"
            onClick={closePhotoGallery}
            className="absolute right-4 top-4 rounded-full bg-white p-2 text-black shadow-md transition-colors hover:bg-slate-200"
            aria-label="Close photo gallery"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative flex h-full flex-col items-center justify-center">
            <button
              type="button"
              onClick={showPreviousPhoto}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-3 text-slate-900 shadow-md transition-colors hover:bg-slate-200 md:left-4"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <div className="flex h-full w-full items-center justify-center px-12">
              <img src={activePhoto.src} alt={activePhoto.name} className="max-h-full w-full object-contain" />
            </div>

            <button
              type="button"
              onClick={showNextPhoto}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-3 text-slate-900 shadow-md transition-colors hover:bg-slate-200 md:right-4"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            <div className="mt-4 text-center text-white">
              <p className="text-lg font-semibold">{activePhoto.name}</p>
              <p className="text-sm text-slate-300">
                {activePhotoIndex + 1} / {dynamicPhotos.length}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
