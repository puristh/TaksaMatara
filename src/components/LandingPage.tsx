interface LandingPageProps {
  onNavigateBatch: () => void;
  onNavigateSingle: () => void;
}

export function LandingPage({ onNavigateBatch, onNavigateSingle }: LandingPageProps) {
  return (
    <div className="landing">
      <h1 className="landing-title">เลือกเลขทะเบียนที่ใช่ ให้เหมาะกับคุณ</h1>
      <p className="landing-subtitle">ทะเบียนรถไม่ใช่แค่ตัวเลข แต่มันคืออัตลักษณ์ของรถคุณ</p>

      <div className="landing-body">
        <p>
          "รถยนต์" คือหนึ่งในพื้นที่ที่คุณใช้เวลาอยู่ด้วยในชีวิตประจำวันมากที่สุด
          การเลือกพาหนะหรือเลขทะเบียนที่เหมาะสมจึงมีความสำคัญมากกว่าที่คุณคิด
          เพราะเลขทะเบียนรถแต่ละชุดจะมีพลังของตัวเลขที่สะท้อนภาพรวมของตัวตนของรถคันนั้นและผู้ครอบครอง
        </p>
        <p>
          ตามความเชื่อและหลักศาสตร์โบราณ ยานพาหนะเปรียบเสมือน "บริวารของเจ้าของ"
          ผู้ช่วยเหลือในการเดินทางและการขับเคลื่อนชีวิต หากเลือกบริวารที่ดี ชีวิตจะราบรื่น
          แต่หากเลือกบริวารที่ไม่สอดคล้องกับเจ้าของ ก็อาจไม่เกื้อหนุนต่อการใช้งานและเป้าหมายของผู้ครอบครอง
        </p>
        <p>
          ไม่ว่าคุณกำลังมองหาเลขทะเบียนใหม่สำหรับรถคันใหม่ หรือต้องการวิเคราะห์เลขทะเบียนที่มีอยู่แล้ว
          เรานำเลขศาสตร์และโหราศาสตร์มาวิเคราะห์เพื่อช่วยให้คุณ ค้นหาเลขที่เหมาะกับดวงชะตาของคุณได้
        </p>
      </div>

      <blockquote className="landing-quote">
        เพราะเลขทะเบียนที่ดีที่สุด ไม่ใช่เลขที่แพงที่สุด... แต่คือเลขที่เหมาะกับดวงชะตา อาชีพ
        และเป้าหมายชีวิตของคุณมากที่สุด
      </blockquote>

      <div className="landing-cta">
        <button type="button" className="cta-secondary" onClick={onNavigateBatch}>
          ค้นหาเลขทะเบียนดีๆ
        </button>
        <button type="button" className="cta-primary" onClick={onNavigateSingle}>
          วิเคราะห์เลขของคุณ
        </button>
      </div>
    </div>
  );
}
