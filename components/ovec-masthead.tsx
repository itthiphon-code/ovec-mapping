import Image from "next/image";

export function OvecMasthead() {
  return (
    <div className="ovec-masthead no-print">
      <Image
        className="ovec-masthead-art"
        src="/images/ovec-mapping-header-v3.png"
        alt="OVEC Mapping เชื่อมโยงมาตรฐานอาชีพสู่รายวิชา เชื่อมหน่วยสมรรถนะ ผลลัพธ์การเรียนรู้ สมรรถนะรายวิชา และเกณฑ์การปฏิบัติงาน"
        width={1983}
        height={793}
        priority
        unoptimized
      />
      <Image
        className="ovec-masthead-seal"
        src="/images/ovec-official-seal.png"
        alt="ตราสำนักงานคณะกรรมการการอาชีวศึกษา"
        width={2063}
        height={2065}
        priority
        unoptimized
      />
    </div>
  );
}
