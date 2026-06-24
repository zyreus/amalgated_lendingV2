<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SettingsValidator
{
    /**
     * @return array<string, mixed>
     */
    public static function rulesForKey(string $key): array
    {
        return match ($key) {
            'company' => [
                'company_name' => 'required|string|max:255',
                'logo_url' => 'nullable|string|max:2048',
                'address' => 'nullable|string|max:500',
                'contact_number' => 'nullable|string|max:64',
                'email_address' => 'nullable|email|max:255',
                'business_hours' => 'nullable|string|max:255',
                'branches' => 'nullable|array',
                'branches.*' => 'string|max:120',
            ],
            'locale' => [
                'timezone' => 'required|string|max:64',
                'date_format' => 'required|string|max:32',
                'currency_display' => 'required|string|max:8',
                'language' => 'required|string|in:en,fil',
            ],
            'loan_defaults' => [
                'interest_rate' => 'nullable|numeric|min:0|max:100',
                'default_annual_rate' => 'nullable|numeric|min:0|max:100',
                'min_loan' => 'nullable|numeric|min:0',
                'max_loan' => 'nullable|numeric|min:0',
                'income_loan_multiplier' => 'nullable|numeric|min:1|max:50',
                'max_term_months' => 'nullable|integer|min:1|max:360',
                'penalty_percent' => 'nullable|numeric|min:0|max:100',
            ],
            'loan_configuration' => [
                'interest_type' => 'required|string|in:flat,reducing_balance',
                'loan_terms_months' => 'nullable|array',
                'loan_terms_months.*' => 'integer|min:1|max:360',
                'penalty_rate' => 'nullable|numeric|min:0|max:100',
                'grace_period_days' => 'nullable|integer|min:0|max:90',
            ],
            'payment_settings' => [
                'currency' => 'required|string|max:8',
                'methods' => 'nullable|array',
                'methods.*' => 'string|max:64',
                'require_proof' => 'boolean',
            ],
            'interest_settings' => [
                'mode' => 'required|string|in:flat,reducing_balance',
                'compounding' => 'boolean',
            ],
            'collection_settings' => [
                'due_day_of_month' => 'integer|min:1|max:28',
                'auto_assign_collector' => 'boolean',
                'escalation_days' => 'integer|min:0|max:365',
                'soa_auto_email' => 'boolean',
            ],
            'notifications' => [
                'email_enabled' => 'boolean',
                'sms_enabled' => 'boolean',
                'auto_send' => 'boolean',
                'reminder_days' => 'nullable|array',
                'reminder_days.*' => 'integer|min:1|max:60',
            ],
            'email_settings' => [
                'smtp_host' => 'nullable|string|max:255',
                'smtp_port' => 'nullable|integer|min:1|max:65535',
                'smtp_user' => 'nullable|string|max:255',
                'smtp_from_name' => 'nullable|string|max:120',
                'smtp_from_email' => 'nullable|email|max:255',
                'template_loan_submitted_subject' => 'nullable|string|max:255',
                'template_loan_approved_subject' => 'nullable|string|max:255',
                'template_loan_rejected_subject' => 'nullable|string|max:255',
            ],
            'credit_scoring' => [
                'enabled' => 'boolean',
                'base_score' => 'integer|min:300|max:900',
            ],
            'security' => [
                'two_factor_enabled' => 'boolean',
                'max_login_attempts' => 'integer|min:3|max:20',
                'session_timeout_minutes' => 'integer|min:5|max:1440',
                'password_min_length' => 'integer|min:8|max:128',
            ],
            'reports' => [
                'default_range' => 'string|in:today,last_7_days,last_30_days,this_month,this_year',
                'export_pdf' => 'boolean',
                'export_excel' => 'boolean',
                'show_metrics' => 'boolean',
            ],
            'integrations' => [
                'crm_enabled' => 'boolean',
                'chat_enabled' => 'boolean',
                'api_keys' => 'nullable|string|max:8000',
            ],
            'audit' => [
                'change_tracking_enabled' => 'boolean',
                'login_history_enabled' => 'boolean',
                'activity_logs_enabled' => 'boolean',
            ],
            'system' => [
                'maintenance_mode' => 'boolean',
                'backup_frequency' => 'string|in:hourly,daily,weekly',
            ],
            'log_cleanup' => [
                'enabled' => 'boolean',
                'retention_days' => 'integer|min:7|max:3650',
                'frequency' => 'string|in:daily,weekly,monthly',
                'optimize_tables' => 'boolean',
            ],
            'branding' => [
                'primary_color' => 'nullable|string|max:32',
                'background_color' => 'nullable|string|max:32',
                'surface_color' => 'nullable|string|max:32',
                'logo_url' => 'nullable|string|max:2048',
            ],
            'website_chat' => [
                'max_visitor_messages_before_first_reply' => 'nullable|integer|min:1|max:50',
                'max_consecutive_visitor_messages' => 'nullable|integer|min:1|max:50',
            ],
            default => [],
        };
    }

    /**
     * @param  array<string, mixed>  $value
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(string $key, array $value): array
    {
        $rules = self::rulesForKey($key);
        if ($rules === []) {
            return $value;
        }

        $validator = Validator::make($value, $rules);
        $validator->validate();

        return $value;
    }
}
