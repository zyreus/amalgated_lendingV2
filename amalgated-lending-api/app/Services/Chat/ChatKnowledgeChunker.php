<?php

namespace App\Services\Chat;

class ChatKnowledgeChunker
{
    /**
     * @return array<int, string>
     */
    public static function split(string $text, int $maxChars, int $overlap): array
    {
        $t = trim(preg_replace("/[ \t\r]+/u", ' ', str_replace(["\r\n", "\r"], "\n", $text)));
        if ($t === '') {
            return [];
        }
        if (mb_strlen($t) <= $maxChars) {
            return [$t];
        }

        $chunks = [];
        $len = mb_strlen($t);
        $start = 0;
        while ($start < $len) {
            $piece = mb_substr($t, $start, $maxChars);
            $chunks[] = trim($piece);
            $start += max(1, $maxChars - $overlap);
        }

        return array_values(array_filter($chunks));
    }
}
