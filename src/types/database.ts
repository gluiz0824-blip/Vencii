export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole =
  "owner" | "admin" | "approver" | "operator" | "viewer";
export type OrganizationMemberStatus = "invited" | "active" | "suspended";
export type PayableDocumentType =
  "boleto" | "pix" | "transferencia" | "cartao" | "imposto" | "outro";
export type PayableStatus =
  | "draft"
  | "pending"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "partial"
  | "paid"
  | "overdue"
  | "rejected"
  | "canceled";
export type PayableSource = "manual" | "upload" | "email" | "import";
export type PayableAttachmentType =
  "boleto" | "invoice" | "tax_document" | "receipt" | "other";
export type AttachmentExtractionStatus =
  "uploaded" | "processing" | "needs_review" | "completed" | "failed";
export type ApprovalRequestStatus =
  "pending" | "approved" | "rejected" | "invalidated";
export type ApprovalDecision = "approved" | "rejected";
export type PaymentMethod =
  | "boleto"
  | "pix"
  | "transferencia"
  | "debito_automatico"
  | "cartao"
  | "dinheiro"
  | "outro";
export type NotificationType =
  | "approval_requested"
  | "approval_completed"
  | "approval_rejected"
  | "approval_due_soon"
  | "payable_due_7_days"
  | "payable_due_3_days"
  | "payable_due_tomorrow"
  | "payable_due_today"
  | "payable_overdue"
  | "document_extraction_failed"
  | "report_export_ready";
export type ReminderEventType = Exclude<
  NotificationType,
  "report_export_ready"
>;
export type NotificationChannel = "internal" | "email" | "whatsapp";
export type ReminderDeliveryStatus =
  "pending" | "processing" | "sent" | "failed" | "skipped";
export type InboundMessageStatus =
  | "received"
  | "processing"
  | "needs_review"
  | "completed"
  | "failed"
  | "ignored"
  | "no_attachments";
export type InboundAttachmentStatus =
  | "pending"
  | "processing"
  | "needs_review"
  | "completed"
  | "failed"
  | "duplicate"
  | "ignored";
export type ReportKind =
  | "forecast"
  | "paid"
  | "overdue"
  | "supplier"
  | "category"
  | "variance"
  | "approvals"
  | "payments";
export type ReportExportFormat = "csv" | "pdf";
export type ReportExportStatus =
  "pending" | "processing" | "completed" | "failed" | "expired";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          legal_name: string;
          trade_name: string;
          cnpj: string | null;
          timezone: string;
          currency: string;
          allow_self_approval: boolean;
          allow_partial_payments: boolean;
          allow_overpayments: boolean;
          overpayment_tolerance_cents: number;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legal_name: string;
          trade_name: string;
          cnpj?: string | null;
          timezone?: string;
          currency?: string;
          allow_self_approval?: boolean;
          allow_partial_payments?: boolean;
          allow_overpayments?: boolean;
          overpayment_tolerance_cents?: number;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          legal_name?: string;
          trade_name?: string;
          cnpj?: string | null;
          timezone?: string;
          currency?: string;
          allow_self_approval?: boolean;
          allow_partial_payments?: boolean;
          allow_overpayments?: boolean;
          overpayment_tolerance_cents?: number;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          status: OrganizationMemberStatus;
          invited_by: string | null;
          joined_at: string | null;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          status?: OrganizationMemberStatus;
          invited_by?: string | null;
          joined_at?: string | null;
        };
        Update: {
          role?: OrganizationRole;
          status?: OrganizationMemberStatus;
          invited_by?: string | null;
          joined_at?: string | null;
        };
        Relationships: [];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          expires_at: string;
          accepted_at: string | null;
          invited_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          expires_at: string;
          accepted_at?: string | null;
          invited_by: string;
          created_at?: string;
        };
        Update: {
          role?: OrganizationRole;
          expires_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          tax_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          tax_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          tax_id?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts_payable: {
        Row: {
          id: string;
          organization_id: string;
          supplier_id: string | null;
          expense_category_id: string | null;
          description: string;
          document_type: PayableDocumentType;
          document_number: string | null;
          barcode: string | null;
          pix_code: string | null;
          document_hash: string | null;
          amount_cents: number;
          issue_date: string | null;
          due_date: string;
          competence_date: string | null;
          status: PayableStatus;
          notes: string | null;
          cancellation_reason: string | null;
          paid_date: string | null;
          payment_notes: string | null;
          recurrence_group_id: string | null;
          installment_number: number | null;
          installment_total: number | null;
          source: PayableSource;
          idempotency_key: string;
          occurrence_index: number;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          supplier_id?: string | null;
          expense_category_id?: string | null;
          description: string;
          document_type: PayableDocumentType;
          document_number?: string | null;
          barcode?: string | null;
          pix_code?: string | null;
          document_hash?: string | null;
          amount_cents: number;
          issue_date?: string | null;
          due_date: string;
          competence_date?: string | null;
          status?: PayableStatus;
          notes?: string | null;
          cancellation_reason?: string | null;
          paid_date?: string | null;
          payment_notes?: string | null;
          recurrence_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          source?: PayableSource;
          idempotency_key: string;
          occurrence_index?: number;
          created_by: string;
          updated_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          supplier_id?: string | null;
          expense_category_id?: string | null;
          description?: string;
          document_type?: PayableDocumentType;
          document_number?: string | null;
          barcode?: string | null;
          pix_code?: string | null;
          document_hash?: string | null;
          amount_cents?: number;
          issue_date?: string | null;
          due_date?: string;
          competence_date?: string | null;
          status?: PayableStatus;
          notes?: string | null;
          cancellation_reason?: string | null;
          paid_date?: string | null;
          payment_notes?: string | null;
          recurrence_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          source?: PayableSource;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payable_attachments: {
        Row: {
          id: string;
          organization_id: string;
          account_payable_id: string | null;
          payment_id: string | null;
          storage_path: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          sha256: string;
          attachment_type: PayableAttachmentType;
          extraction_status: AttachmentExtractionStatus;
          extraction_data: Json | null;
          duplicate_of_attachment_id: string | null;
          processing_attempts: number;
          last_error: string | null;
          uploaded_by: string;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          account_payable_id?: string | null;
          payment_id?: string | null;
          storage_path: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          sha256: string;
          attachment_type?: PayableAttachmentType;
          extraction_status?: AttachmentExtractionStatus;
          extraction_data?: Json | null;
          duplicate_of_attachment_id?: string | null;
          processing_attempts?: number;
          last_error?: string | null;
          uploaded_by: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_payable_id?: string | null;
          payment_id?: string | null;
          attachment_type?: PayableAttachmentType;
          extraction_status?: AttachmentExtractionStatus;
          extraction_data?: Json | null;
          duplicate_of_attachment_id?: string | null;
          processing_attempts?: number;
          last_error?: string | null;
          processed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          account_payable_id: string;
          paid_amount_cents: number;
          paid_at: string;
          payment_method: PaymentMethod;
          bank_reference: string | null;
          notes: string | null;
          idempotency_key: string;
          registered_by: string;
          reversed_at: string | null;
          reversed_by: string | null;
          reversal_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      approval_rules: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          min_amount_cents: number | null;
          max_amount_cents: number | null;
          category_id: string | null;
          supplier_id: string | null;
          required_approvals: number;
          active: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          min_amount_cents?: number | null;
          max_amount_cents?: number | null;
          category_id?: string | null;
          supplier_id?: string | null;
          required_approvals?: number;
          active?: boolean;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          min_amount_cents?: number | null;
          max_amount_cents?: number | null;
          category_id?: string | null;
          supplier_id?: string | null;
          required_approvals?: number;
          active?: boolean;
          priority?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payable_approval_requests: {
        Row: {
          id: string;
          organization_id: string;
          account_payable_id: string;
          rule_id: string | null;
          required_approvals: number;
          status: ApprovalRequestStatus;
          requested_by: string;
          requested_at: string;
          completed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payable_approvals: {
        Row: {
          id: string;
          organization_id: string;
          request_id: string;
          approver_id: string;
          decision: ApprovalDecision;
          comment: string | null;
          decided_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      report_exports: {
        Row: {
          id: string;
          organization_id: string;
          requested_by: string;
          report_kind: ReportKind;
          format: ReportExportFormat;
          filters: Json;
          status: ReportExportStatus;
          storage_path: string | null;
          size_bytes: number | null;
          row_count: number | null;
          error_message: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inbound_addresses: {
        Row: {
          id: string;
          organization_id: string;
          local_part: string;
          active: boolean;
          rotated_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inbound_messages: {
        Row: {
          id: string;
          organization_id: string;
          inbound_address_id: string;
          provider: string;
          provider_message_id: string;
          sender_email: string;
          subject: string;
          received_at: string;
          status: InboundMessageStatus;
          raw_metadata: Json;
          idempotency_key: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          inbound_address_id: string;
          provider: string;
          provider_message_id: string;
          sender_email: string;
          subject?: string;
          received_at: string;
          status?: InboundMessageStatus;
          raw_metadata?: Json;
          idempotency_key: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: InboundMessageStatus;
          error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inbound_message_attachments: {
        Row: {
          id: string;
          organization_id: string;
          inbound_message_id: string;
          attachment_id: string | null;
          provider_attachment_id: string;
          original_name: string;
          processing_status: InboundAttachmentStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          inbound_message_id: string;
          attachment_id?: string | null;
          provider_attachment_id: string;
          original_name: string;
          processing_status?: InboundAttachmentStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          attachment_id?: string | null;
          processing_status?: InboundAttachmentStatus;
          error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          message: string;
          entity_type: string;
          entity_id: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      reminder_rules: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          event_type: ReminderEventType;
          days_before: number;
          channel: NotificationChannel;
          target_roles: OrganizationRole[];
          active: boolean;
          critical: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          organization_id: string;
          user_id: string;
          event_type: ReminderEventType;
          internal_enabled: boolean;
          email_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          event_type: ReminderEventType;
          internal_enabled?: boolean;
          email_enabled?: boolean;
        };
        Update: {
          internal_enabled?: boolean;
          email_enabled?: boolean;
        };
        Relationships: [];
      };
      reminder_deliveries: {
        Row: {
          id: string;
          organization_id: string;
          rule_id: string;
          notification_id: string | null;
          account_payable_id: string | null;
          user_id: string;
          channel: NotificationChannel;
          scheduled_for: string;
          sent_at: string | null;
          status: ReminderDeliveryStatus;
          provider_message_id: string | null;
          error_code: string | null;
          attempts: number;
          next_attempt_at: string;
          payload: Json;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_management_report: {
        Args: {
          p_organization_id: string;
          p_date_from: string;
          p_date_to: string;
          p_report_kind?: ReportKind;
          p_business_date?: string;
          p_status?: PayableStatus | null;
          p_supplier_id?: string | null;
          p_category_id?: string | null;
          p_payment_method?: PaymentMethod | null;
          p_responsible_user_id?: string | null;
          p_page?: number;
          p_page_size?: number;
          p_actor_user_id?: string | null;
        };
        Returns: Json;
      };
      enqueue_report_export: {
        Args: {
          p_organization_id: string;
          p_report_kind: ReportKind;
          p_format: ReportExportFormat;
          p_filters: Json;
        };
        Returns: string;
      };
      record_immediate_report_export: {
        Args: {
          p_organization_id: string;
          p_report_kind: ReportKind;
          p_format: ReportExportFormat;
          p_filters: Json;
          p_row_count: number;
        };
        Returns: undefined;
      };
      claim_report_exports: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          organization_id: string;
          requested_by: string;
          report_kind: ReportKind;
          format: ReportExportFormat;
          filters: Json;
        }[];
      };
      finish_report_export: {
        Args: {
          p_export_id: string;
          p_success: boolean;
          p_storage_path?: string | null;
          p_size_bytes?: number | null;
          p_row_count?: number | null;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      expire_report_exports: { Args: Record<string, never>; Returns: string[] };
      rotate_inbound_address: {
        Args: { p_organization_id: string };
        Returns: string;
      };
      ignore_inbound_message: {
        Args: { p_organization_id: string; p_message_id: string };
        Returns: undefined;
      };
      register_inbound_message: {
        Args: {
          p_provider: string;
          p_provider_message_id: string;
          p_local_part: string;
          p_sender_email: string;
          p_subject: string;
          p_received_at: string;
          p_raw_metadata: Json;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      complete_onboarding: {
        Args: {
          p_full_name: string;
          p_phone: string;
          p_legal_name: string;
          p_trade_name: string;
          p_cnpj: string;
          p_timezone?: string;
          p_currency?: string;
        };
        Returns: string;
      };
      transfer_organization_ownership: {
        Args: { p_organization_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      accept_organization_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      cancel_account_payable: {
        Args: {
          p_organization_id: string;
          p_account_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      mark_account_payable_paid: {
        Args: {
          p_organization_id: string;
          p_account_id: string;
          p_paid_date: string;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      register_account_payment: {
        Args: {
          p_organization_id: string;
          p_account_id: string;
          p_paid_amount_cents: number;
          p_paid_at: string;
          p_payment_method: PaymentMethod;
          p_bank_reference?: string | null;
          p_notes?: string | null;
          p_idempotency_key: string;
          p_confirm_overpayment?: boolean;
        };
        Returns: string;
      };
      reverse_account_payment: {
        Args: {
          p_organization_id: string;
          p_payment_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      request_payable_approval: {
        Args: { p_organization_id: string; p_account_id: string };
        Returns: string;
      };
      decide_payable_approval: {
        Args: {
          p_organization_id: string;
          p_request_id: string;
          p_decision: ApprovalDecision;
          p_comment?: string | null;
        };
        Returns: ApprovalRequestStatus;
      };
      approve_payable_requests_batch: {
        Args: {
          p_organization_id: string;
          p_request_ids: string[];
          p_comment?: string | null;
        };
        Returns: number;
      };
      get_approval_inbox: {
        Args: {
          p_organization_id: string;
          p_business_date: string;
          p_urgency?: string | null;
          p_due_from?: string | null;
          p_due_to?: string | null;
          p_min_amount_cents?: number | null;
          p_max_amount_cents?: number | null;
          p_supplier_id?: string | null;
        };
        Returns: {
          request_id: string;
          account_id: string;
          description: string;
          supplier_name: string | null;
          amount_cents: number;
          due_date: string;
          document_type: PayableDocumentType;
          document_number: string | null;
          barcode: string | null;
          required_approvals: number;
          approval_count: number;
          requested_at: string;
          created_by: string;
          can_decide: boolean;
        }[];
      };
      create_due_approval_notifications: {
        Args: {
          p_organization_id: string;
          p_business_date: string;
          p_days_ahead?: number;
        };
        Returns: number;
      };
      get_financial_dashboard_summary: {
        Args: { p_organization_id: string; p_business_date: string };
        Returns: Json;
      };
      get_financial_forecast: {
        Args: { p_organization_id: string; p_business_date: string };
        Returns: Json;
      };
      get_financial_distributions: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      get_financial_alerts: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      get_payables_calendar: {
        Args: {
          p_organization_id: string;
          p_date_from: string;
          p_date_to: string;
          p_status?: PayableStatus | null;
          p_supplier_id?: string | null;
          p_category_id?: string | null;
        };
        Returns: {
          due_date: string;
          account_count: number;
          total_cents: number;
          accounts: Json;
        }[];
      };
      mark_overdue_accounts: {
        Args: { p_organization_id: string; p_business_date: string };
        Returns: number;
      };
      claim_attachment_extraction: {
        Args: { p_organization_id: string; p_attachment_id: string };
        Returns: boolean;
      };
      finish_attachment_extraction: {
        Args: {
          p_organization_id: string;
          p_attachment_id: string;
          p_status: AttachmentExtractionStatus;
          p_extraction_data: Json;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      review_payable_attachment: {
        Args: {
          p_organization_id: string;
          p_attachment_id: string;
          p_account_payable_id: string | null;
          p_review_data: Json;
        };
        Returns: undefined;
      };
      schedule_reminders: {
        Args: { p_now?: string };
        Returns: {
          notifications_created: number;
          deliveries_created: number;
        }[];
      };
      claim_reminder_deliveries: {
        Args: { p_limit?: number };
        Returns: {
          delivery_id: string;
          recipient_email: string;
          idempotency_key: string;
          title: string;
          body: string;
          path: string;
          attempt: number;
        }[];
      };
      finish_reminder_delivery: {
        Args: {
          p_delivery_id: string;
          p_success: boolean;
          p_provider_message_id?: string | null;
          p_error_code?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      organization_member_status: OrganizationMemberStatus;
      payable_document_type: PayableDocumentType;
      payable_status: PayableStatus;
      payable_source: PayableSource;
      payable_attachment_type: PayableAttachmentType;
      attachment_extraction_status: AttachmentExtractionStatus;
      approval_request_status: ApprovalRequestStatus;
      approval_decision: ApprovalDecision;
      notification_type: NotificationType;
      payment_method: PaymentMethod;
      reminder_event_type: ReminderEventType;
      notification_channel: NotificationChannel;
      reminder_delivery_status: ReminderDeliveryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
